{
  description = "Learn Your Appetite application and PDF development environment";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { nixpkgs, flake-utils, ... }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
        lib = pkgs.lib;

        commonInputs = with pkgs; [
          bash
          bun
          coreutils
          curl
          diffutils
          findutils
          gnugrep
          gnused
          git
          imagemagick
          jq
          openssl
          ripgrep
        ];

        darwinInputs = lib.optionals pkgs.stdenv.hostPlatform.isDarwin (with pkgs; [
          xcbeautify
          xcodegen
        ]);

        darwinGuard = ''
          if [[ "$(uname -s)" != "Darwin" ]]; then
            echo "This command requires macOS and Apple's Xcode." >&2
            exit 1
          fi

          default_developer_dir="/Applications/Xcode.app/Contents/Developer"
          export DEVELOPER_DIR="''${HUNGER_DEVELOPER_DIR:-$default_developer_dir}"
          export PATH="/usr/bin:/bin:/usr/sbin:/sbin:$PATH"
          if [[ ! -x "$DEVELOPER_DIR/usr/bin/xcodebuild" ]]; then
            echo "Xcode was not found at $DEVELOPER_DIR." >&2
            exit 1
          fi
        '';

        repoGuard = ''
          repo_root="$(git rev-parse --show-toplevel)"
          cd "$repo_root"
          if [[ ! -f "flake.nix" || ! -f "IOS_DESIGN.md" ]]; then
            echo "Run this command from the Hunger repository." >&2
            exit 1
          fi
        '';

        iosGenerateAppIcon = pkgs.writeShellApplication {
          name = "hunger-ios-generate-app-icon";
          runtimeInputs = commonInputs;
          text = ''
            ${repoGuard}
            source_icon="$repo_root/static/icon.svg"
            target_icon="$repo_root/ios/Hunger/Assets.xcassets/AppIcon.appiconset/AppIcon.png"
            if [[ ! -f "$source_icon" ]]; then
              echo "App icon source is missing: $source_icon" >&2
              exit 1
            fi
            mkdir -p "$(dirname "$target_icon")"
            magick \
              -background '#f7f4ee' \
              -density 384 \
              "$source_icon" \
              -flatten \
              -resize 1024x1024! \
              -alpha off \
              -colorspace sRGB \
              -strip \
              -define png:exclude-chunks=date,time \
              "PNG24:$target_icon"
            dimensions="$(magick identify -format '%wx%h' "$target_icon")"
            alpha="$(magick identify -format '%[channels]' "$target_icon")"
            if [[ "$dimensions" != "1024x1024" || "$alpha" == *a* ]]; then
              echo "Generated App Store icon is invalid: dimensions=$dimensions channels=$alpha" >&2
              exit 1
            fi
            echo "Generated opaque 1024x1024 App Store icon."
          '';
        };

        testflightCommon = ''
          config_path="''${HUNGER_TESTFLIGHT_CONFIG:-$HOME/.config/hunger/testflight.env}"
          if [[ ! -f "$config_path" ]]; then
            echo "TestFlight handoff is missing. Run: nix run .#ios-testflight-configure" >&2
            exit 1
          fi
          config_mode="$(/usr/bin/stat -f '%Lp' "$config_path")"
          if (( (8#$config_mode & 8#077) != 0 )); then
            echo "TestFlight handoff must be owner-only (mode 600): $config_path" >&2
            exit 1
          fi
          # shellcheck disable=SC1090
          source "$config_path"
          required_variables=(
            HUNGER_APPLE_TEAM_ID
            HUNGER_ASC_ISSUER_ID
            HUNGER_ASC_KEY_ID
            HUNGER_ASC_KEY_PATH
            HUNGER_ASC_APP_BUNDLE_ID
            HUNGER_ASC_APP_NAME
            HUNGER_ASC_APP_SKU
            HUNGER_ASC_PRIMARY_LOCALE
            HUNGER_TESTFLIGHT_GROUP
            HUNGER_TESTFLIGHT_TESTER_EMAIL
          )
          for variable_name in "''${required_variables[@]}"; do
            if [[ -z "''${!variable_name:-}" ]]; then
              echo "Missing $variable_name in $config_path" >&2
              exit 1
            fi
          done
          if [[ ! -f "$HUNGER_ASC_KEY_PATH" ]]; then
            echo "App Store Connect private key is missing at its configured path." >&2
            exit 1
          fi
          if (( (8#$(/usr/bin/stat -f '%Lp' "$HUNGER_ASC_KEY_PATH") & 8#077) != 0 )); then
            echo "App Store Connect private key must be owner-only." >&2
            exit 1
          fi
          openssl pkey -in "$HUNGER_ASC_KEY_PATH" -noout >/dev/null

          asc_token() {
            bun -e '
              const { readFileSync } = require("fs");
              const { createPrivateKey, sign } = require("crypto");
              const encode = value => Buffer.from(JSON.stringify(value)).toString("base64url");
              const now = Math.floor(Date.now() / 1000);
              const input = encode({ alg: "ES256", kid: process.argv[3], typ: "JWT" }) + "." +
                encode({ iss: process.argv[2], iat: now - 5, exp: now + 600, aud: "appstoreconnect-v1" });
              const signature = sign("sha256", Buffer.from(input), {
                key: createPrivateKey(readFileSync(process.argv[1])),
                dsaEncoding: "ieee-p1363"
              }).toString("base64url");
              process.stdout.write(input + "." + signature);
            ' "$HUNGER_ASC_KEY_PATH" "$HUNGER_ASC_ISSUER_ID" "$HUNGER_ASC_KEY_ID"
          }

          asc_request() {
            local method="$1"
            local path="$2"
            local body="''${3:-}"
            local token
            token="$(asc_token)"
            if [[ "$method" == "GET" ]]; then
              curl --fail-with-body --silent --show-error \
                --retry 3 --retry-all-errors \
                -H "Authorization: Bearer $token" \
                -H 'Accept: application/json' \
                "https://api.appstoreconnect.apple.com$path"
            else
              curl --fail-with-body --silent --show-error \
                -X "$method" \
                -H "Authorization: Bearer $token" \
                -H 'Accept: application/json' \
                -H 'Content-Type: application/json' \
                --data "$body" \
                "https://api.appstoreconnect.apple.com$path"
            fi
          }

          url_encode() {
            jq -rn --arg value "$1" '$value | @uri'
          }
        '';

        iosTestflightConfigure = pkgs.writeShellApplication {
          name = "hunger-ios-testflight-configure";
          runtimeInputs = commonInputs;
          text = ''
            ${repoGuard}
            source_config="''${HUNGER_TESTFLIGHT_SOURCE_CONFIG:-$HOME/.config/player/testflight.env}"
            target_directory="$HOME/.config/hunger"
            target_config="$target_directory/testflight.env"
            if [[ -e "$target_config" ]]; then
              echo "Hunger TestFlight handoff already exists at $target_config"
              echo "Remove it explicitly before replacing its identifiers."
              exit 0
            fi
            if [[ ! -f "$source_config" ]]; then
              echo "No reusable Apple handoff was found at $source_config." >&2
              echo "Follow TESTFLIGHT_SETUP.md, then rerun this command." >&2
              exit 1
            fi
            if (( (8#$(/usr/bin/stat -f '%Lp' "$source_config") & 8#077) != 0 )); then
              echo "Source Apple handoff must be owner-only (mode 600)." >&2
              exit 1
            fi
            # shellcheck disable=SC1090
            source "$source_config"
            for variable_name in PLAYER_APPLE_TEAM_ID PLAYER_ASC_ISSUER_ID PLAYER_ASC_KEY_ID \
              PLAYER_ASC_KEY_PATH PLAYER_TESTFLIGHT_TESTER_EMAIL; do
              if [[ -z "''${!variable_name:-}" ]]; then
                echo "Source handoff is missing $variable_name." >&2
                exit 1
              fi
            done
            if [[ ! -f "$PLAYER_ASC_KEY_PATH" ]]; then
              echo "The source handoff's private key is missing." >&2
              exit 1
            fi
            install -d -m 700 "$target_directory"
            temporary_config="$(mktemp "$target_directory/testflight.env.XXXXXX")"
            trap 'rm -f "$temporary_config"' EXIT
            chmod 600 "$temporary_config"
            {
              printf 'HUNGER_APPLE_TEAM_ID=%q\n' "$PLAYER_APPLE_TEAM_ID"
              printf 'HUNGER_ASC_ISSUER_ID=%q\n' "$PLAYER_ASC_ISSUER_ID"
              printf 'HUNGER_ASC_KEY_ID=%q\n' "$PLAYER_ASC_KEY_ID"
              printf 'HUNGER_ASC_KEY_PATH=%q\n' "$PLAYER_ASC_KEY_PATH"
              printf 'HUNGER_ASC_APP_BUNDLE_ID=%q\n' 'com.anicolao.hunger'
              printf 'HUNGER_ASC_APP_NAME=%q\n' 'Learn Your Appetite'
              printf 'HUNGER_ASC_APP_SKU=%q\n' 'hunger-ios'
              printf 'HUNGER_ASC_PRIMARY_LOCALE=%q\n' 'en-CA'
              printf 'HUNGER_TESTFLIGHT_GROUP=%q\n' 'Internal'
              printf 'HUNGER_TESTFLIGHT_TESTER_EMAIL=%q\n' "$PLAYER_TESTFLIGHT_TESTER_EMAIL"
            } > "$temporary_config"
            mv "$temporary_config" "$target_config"
            trap - EXIT
            echo "Installed owner-only Hunger TestFlight handoff at $target_config"
          '';
        };

        iosTestflightPreflight = pkgs.writeShellApplication {
          name = "hunger-ios-testflight-preflight";
          runtimeInputs = commonInputs;
          text = ''
            ${darwinGuard}
            ${repoGuard}
            ${testflightCommon}
            bundle_identifier="$(url_encode "$HUNGER_ASC_APP_BUNDLE_ID")"
            tester_email="$(url_encode "$HUNGER_TESTFLIGHT_TESTER_EMAIL")"
            bundle_response="$(asc_request GET "/v1/bundleIds?filter%5Bidentifier%5D=$bundle_identifier&limit=1")"
            app_response="$(asc_request GET "/v1/apps?filter%5BbundleId%5D=$bundle_identifier&limit=1")"
            tester_response="$(asc_request GET "/v1/betaTesters?filter%5Bemail%5D=$tester_email&limit=1")"
            signing_identities="$(/usr/bin/security find-identity -v -p codesigning | awk '/valid identities found/ {print $1}')"
            printf 'api_access=valid\n'
            printf 'bundle_id_records=%s\n' "$(jq '.data | length' <<< "$bundle_response")"
            printf 'app_records=%s\n' "$(jq '.data | length' <<< "$app_response")"
            printf 'configured_beta_testers=%s\n' "$(jq '.data | length' <<< "$tester_response")"
            printf 'local_code_signing_identities=%s\n' "$signing_identities"
            app_id="$(jq -r '.data[0].id // empty' <<< "$app_response")"
            tester_id="$(jq -r '.data[0].id // empty' <<< "$tester_response")"
            if [[ -n "$app_id" && -n "$tester_id" ]]; then
              user_response="$(asc_request GET "/v1/users?filter%5Busername%5D=$tester_email&limit=1")"
              printf 'configured_team_users=%s\n' "$(jq '.data | length' <<< "$user_response")"
              printf 'team_user_all_apps_visible=%s\n' "$(jq -r '.data[0].attributes.allAppsVisible // false' <<< "$user_response")"
              printf 'team_user_roles=%s\n' "$(jq -r '.data[0].attributes.roles | join(",")' <<< "$user_response")"
              tester_apps="$(asc_request GET "/v1/betaTesters/$tester_id/relationships/apps?limit=200")"
              tester_groups="$(asc_request GET "/v1/betaTesters/$tester_id/relationships/betaGroups?limit=200")"
              printf 'tester_app_relationships=%s\n' "$(jq '.data | length' <<< "$tester_apps")"
              printf 'tester_group_relationships=%s\n' "$(jq '.data | length' <<< "$tester_groups")"
              printf 'tester_has_hunger_app=%s\n' "$(jq -e --arg id "$app_id" 'any(.data[]; .id == $id)' <<< "$tester_apps")"
              hunger_groups="$(asc_request GET "/v1/betaGroups?filter%5Bapp%5D=$app_id&filter%5BisInternalGroup%5D=true&limit=200")"
              printf 'hunger_internal_groups=%s\n' "$(jq -c '[.data[].attributes.name]' <<< "$hunger_groups")"
              printf 'tester_hunger_group_relationships=%s\n' "$(jq --argjson groups "$(jq '[.data[].id]' <<< "$hunger_groups")" '[.data[] | select(.id as $id | $groups | index($id))] | length' <<< "$tester_groups")"
              hunger_group_id="$(jq -r --arg name "$HUNGER_TESTFLIGHT_GROUP" '.data[] | select(.attributes.name == $name) | .id' <<< "$hunger_groups" | head -n 1)"
              if [[ -n "$hunger_group_id" ]]; then
                hunger_group_testers="$(asc_request GET "/v1/betaGroups/$hunger_group_id/betaTesters?limit=200")"
                printf 'hunger_group_tester_count=%s\n' "$(jq '.data | length' <<< "$hunger_group_testers")"
                printf 'hunger_group_has_configured_tester=%s\n' "$(jq -e --arg id "$tester_id" 'any(.data[]; .id == $id)' <<< "$hunger_group_testers")"
              fi
              tester_detail="$(asc_request GET "/v1/betaTesters/$tester_id")"
              printf 'tester_type=%s\n' "$(jq -c '.data.attributes | del(.email, .firstName, .lastName)' <<< "$tester_detail")"
              tester_group_detail="$(asc_request GET "/v1/betaTesters/$tester_id/betaGroups?limit=200")"
              printf 'tester_existing_groups=%s\n' "$(jq -c '[.data[] | {name:.attributes.name,isInternalGroup:.attributes.isInternalGroup}]' <<< "$tester_group_detail")"
              latest_build="$(asc_request GET "/v1/builds?filter%5Bapp%5D=$app_id&sort=-uploadedDate&limit=1")"
              latest_build_id="$(jq -r '.data[0].id // empty' <<< "$latest_build")"
              printf 'latest_build=%s\n' "$(jq -c '.data[0].attributes | {version,processingState,uploadedDate,expirationDate}' <<< "$latest_build")"
              if [[ -n "$latest_build_id" ]]; then
                beta_detail="$(asc_request GET "/v1/buildBetaDetails?filter%5Bbuild%5D=$latest_build_id&limit=1")"
                printf 'latest_internal_build_state=%s\n' "$(jq -r '.data[0].attributes.internalBuildState // "NOT_VISIBLE"' <<< "$beta_detail")"
              fi
            fi
            if [[ "$(jq '.data | length' <<< "$tester_response")" != "1" ]]; then
              echo "Configured tester is not an existing App Store Connect beta tester." >&2
              exit 1
            fi
            if [[ -z "$signing_identities" || "$signing_identities" == "0" ]]; then
              echo "No Apple code-signing identity is available in the login keychain." >&2
              exit 1
            fi
          '';
        };

        iosTestflightBootstrap = pkgs.writeShellApplication {
          name = "hunger-ios-testflight-bootstrap";
          runtimeInputs = commonInputs;
          text = ''
            ${darwinGuard}
            ${repoGuard}
            ${testflightCommon}
            artifact_root="$repo_root/.artifacts/ios"
            mkdir -p "$artifact_root"

            bundle_identifier="$(url_encode "$HUNGER_ASC_APP_BUNDLE_ID")"
            bundle_response="$(asc_request GET "/v1/bundleIds?filter%5Bidentifier%5D=$bundle_identifier&limit=1")"
            bundle_id="$(jq -r '.data[0].id // empty' <<< "$bundle_response")"
            if [[ -z "$bundle_id" ]]; then
              bundle_body="$(jq -nc \
                --arg identifier "$HUNGER_ASC_APP_BUNDLE_ID" \
                --arg name "$HUNGER_ASC_APP_NAME" \
                '{data:{type:"bundleIds",attributes:{identifier:$identifier,name:$name,platform:"IOS"}}}')"
              bundle_response="$(asc_request POST '/v1/bundleIds' "$bundle_body")" || {
                echo "Apple rejected the Hunger bundle ID registration." >&2
                exit 1
              }
              bundle_id="$(jq -r '.data.id' <<< "$bundle_response")"
              echo "Registered Hunger bundle ID."
            else
              echo "Reusing Hunger bundle ID."
            fi

            app_response="$(asc_request GET "/v1/apps?filter%5BbundleId%5D=$bundle_identifier&limit=1")"
            app_id="$(jq -r '.data[0].id // empty' <<< "$app_response")"
            if [[ -z "$app_id" ]]; then
              echo "The one-time App Store Connect app record is missing." >&2
              echo "Create it in App Store Connect using TESTFLIGHT_SETUP.md, then rerun this command." >&2
              exit 2
            fi
            echo "Reusing Hunger App Store Connect app record."

            group_response="$(asc_request GET "/v1/betaGroups?filter%5Bapp%5D=$app_id&filter%5BisInternalGroup%5D=true&limit=200")"
            group_id="$(jq -r --arg name "$HUNGER_TESTFLIGHT_GROUP" \
              '.data[] | select(.attributes.name == $name) | .id' <<< "$group_response" | head -n 1)"
            if [[ -z "$group_id" ]]; then
              group_body="$(jq -nc \
                --arg appId "$app_id" \
                --arg name "$HUNGER_TESTFLIGHT_GROUP" \
                '{data:{type:"betaGroups",attributes:{name:$name,isInternalGroup:true,feedbackEnabled:true},relationships:{app:{data:{type:"apps",id:$appId}}}}}')"
              group_response="$(asc_request POST '/v1/betaGroups' "$group_body")"
              group_id="$(jq -r '.data.id' <<< "$group_response")"
              echo "Created internal TestFlight group."
            else
              echo "Reusing internal TestFlight group."
            fi

            tester_email="$(url_encode "$HUNGER_TESTFLIGHT_TESTER_EMAIL")"
            user_response="$(asc_request GET "/v1/users?filter%5Busername%5D=$tester_email&limit=1")"
            user_id="$(jq -r '.data[0].id // empty' <<< "$user_response")"
            if [[ -z "$user_id" ]]; then
              echo "Configured tester is not an accepted App Store Connect team user." >&2
              exit 1
            fi
            all_apps_visible="$(jq -r '.data[0].attributes.allAppsVisible // false' <<< "$user_response")"
            if [[ "$all_apps_visible" != "true" ]]; then
              visible_apps="$(asc_request GET "/v1/users/$user_id/relationships/visibleApps?limit=200")"
              if ! jq -e --arg id "$app_id" '.data[] | select(.id == $id)' <<< "$visible_apps" >/dev/null; then
                app_link="$(jq -nc --arg id "$app_id" '{data:[{type:"apps",id:$id}]}')"
                asc_request POST "/v1/users/$user_id/relationships/visibleApps" "$app_link" >/dev/null
                echo "Granted the configured tester access to the Hunger app."
              fi
            fi
            tester_response="$(asc_request GET "/v1/betaTesters?filter%5Bemail%5D=$tester_email&limit=1")"
            tester_id="$(jq -r '.data[0].id // empty' <<< "$tester_response")"
            if [[ -z "$tester_id" ]]; then
              echo "Configured tester must first be an App Store Connect user and beta tester." >&2
              exit 1
            fi
            group_testers="$(asc_request GET "/v1/betaGroups/$group_id/relationships/betaTesters?limit=200")"
            if jq -e --arg id "$tester_id" '.data[] | select(.id == $id)' <<< "$group_testers" >/dev/null; then
              echo "Configured tester is already in the internal group."
            else
              group_builds="$(asc_request GET "/v1/betaGroups/$group_id/relationships/builds?limit=1")"
              if [[ "$(jq '.data | length' <<< "$group_builds")" == "0" ]]; then
                echo "Tester assignment is deferred until the first processed build joins the group."
              else
                tester_link="$(jq -nc --arg id "$tester_id" '{data:[{type:"betaTesters",id:$id}]}')"
                tester_link_response=""
                tester_link_error="$(mktemp)"
                if ! tester_link_response="$(asc_request POST "/v1/betaGroups/$group_id/relationships/betaTesters" "$tester_link" 2>"$tester_link_error")"; then
                  rm -f "$tester_link_error"
                  tester_link_status="$(jq -r '.errors[0].status // empty' <<< "$tester_link_response")"
                  if [[ "$tester_link_status" == "409" ]]; then
                    echo "Tester assignment remains deferred to release finalization or an existing internal tester."
                  else
                    jq -r '.errors[]? | "Apple: \(.code) — \(.detail)"' <<< "$tester_link_response" >&2
                    echo "Apple rejected the tester-group assignment. Check the tester's app access." >&2
                    exit 1
                  fi
                else
                  rm -f "$tester_link_error"
                  echo "Added configured tester to the internal group."
                fi
              fi
            fi

            jq -n \
              --arg appId "$app_id" \
              --arg bundleId "$bundle_id" \
              --arg betaGroupId "$group_id" \
              --arg betaTesterId "$tester_id" \
              '{appId:$appId,bundleId:$bundleId,betaGroupId:$betaGroupId,betaTesterId:$betaTesterId}' \
              > "$artifact_root/testflight-bootstrap.json"
            echo "App Store Connect bootstrap is ready."
          '';
        };

        iosTestflightAddTester = pkgs.writeShellApplication {
          name = "hunger-ios-testflight-add-tester";
          runtimeInputs = commonInputs;
          text = ''
            ${darwinGuard}
            ${repoGuard}
            ${testflightCommon}
            tester_email="''${1:-}"
            if [[ -z "$tester_email" || "$tester_email" != *@*.* ]]; then
              echo "Usage: nix run .#ios-testflight-add-tester -- tester@example.com" >&2
              exit 1
            fi

            state_path="$repo_root/.artifacts/ios/testflight-bootstrap.json"
            if [[ ! -f "$state_path" ]]; then
              echo "App Store Connect bootstrap state is missing." >&2
              echo "Run: nix run .#ios-testflight-bootstrap" >&2
              exit 1
            fi
            app_id="$(jq -r '.appId' "$state_path")"
            group_id="$(jq -r '.betaGroupId' "$state_path")"
            encoded_email="$(url_encode "$tester_email")"

            user_response="$(asc_request GET "/v1/users?filter%5Busername%5D=$encoded_email&limit=2")"
            if [[ "$(jq '.data | length' <<< "$user_response")" != "1" ]]; then
              echo "$tester_email is not an accepted App Store Connect team user." >&2
              echo "Invite and activate the user in Users and Access before adding them as an internal tester." >&2
              exit 2
            fi
            user_id="$(jq -r '.data[0].id' <<< "$user_response")"
            user_roles="$(jq -r '.data[0].attributes.roles | join(",")' <<< "$user_response")"
            if ! jq -e '.data[0].attributes.roles | any(. == "ACCOUNT_HOLDER" or . == "ADMIN" or . == "APP_MANAGER" or . == "DEVELOPER" or . == "MARKETING")' <<< "$user_response" >/dev/null; then
              echo "$tester_email does not have an Apple role eligible for internal testing: $user_roles" >&2
              exit 2
            fi
            if [[ "$(jq -r '.data[0].attributes.allAppsVisible // false' <<< "$user_response")" != "true" ]]; then
              visible_apps="$(asc_request GET "/v1/users/$user_id/relationships/visibleApps?limit=200")"
              if ! jq -e --arg id "$app_id" '.data[] | select(.id == $id)' <<< "$visible_apps" >/dev/null; then
                app_link="$(jq -nc --arg id "$app_id" '{data:[{type:"apps",id:$id}]}')"
                asc_request POST "/v1/users/$user_id/relationships/visibleApps" "$app_link" >/dev/null
                echo "Granted $tester_email access to Learn Your Appetite."
              fi
            fi

            tester_response="$(asc_request GET "/v1/betaTesters?filter%5Bemail%5D=$encoded_email&limit=200")"
            tester_count="$(jq '.data | length' <<< "$tester_response")"
            first_name="$(jq -r '.data[0].attributes.firstName // empty' <<< "$user_response")"
            last_name="$(jq -r '.data[0].attributes.lastName // empty' <<< "$user_response")"
            create_body="$(jq -nc \
              --arg email "$tester_email" \
              --arg firstName "$first_name" \
              --arg lastName "$last_name" \
              --arg groupId "$group_id" \
              '{data:{type:"betaTesters",attributes:{email:$email,firstName:$firstName,lastName:$lastName},relationships:{betaGroups:{data:[{type:"betaGroups",id:$groupId}]}}}}')"
            if [[ "$tester_count" == "0" ]]; then
              tester_response="$(asc_request POST '/v1/betaTesters' "$create_body")"
              tester_id="$(jq -r '.data.id' <<< "$tester_response")"
              echo "Created the internal beta tester for $tester_email."
            else
              internal_candidates=()
              other_candidates=()
              while IFS= read -r candidate_id; do
                candidate_groups="$(asc_request GET "/v1/betaTesters/$candidate_id/betaGroups?limit=200")"
                if jq -e 'any(.data[]; .attributes.isInternalGroup == true)' <<< "$candidate_groups" >/dev/null; then
                  internal_candidates+=("$candidate_id")
                else
                  other_candidates+=("$candidate_id")
                fi
              done < <(jq -r '.data[].id' <<< "$tester_response")

              candidate_ids=("''${internal_candidates[@]}" "''${other_candidates[@]}")
              tester_id=""
              group_link="$(jq -nc --arg id "$group_id" '{data:[{type:"betaGroups",id:$id}]}')"
              for candidate_id in "''${candidate_ids[@]}"; do
                candidate_groups="$(asc_request GET "/v1/betaTesters/$candidate_id/relationships/betaGroups?limit=200")"
                if jq -e --arg id "$group_id" '.data[] | select(.id == $id)' <<< "$candidate_groups" >/dev/null; then
                  tester_id="$candidate_id"
                  echo "$tester_email is already in the Hunger internal group."
                  break
                fi

                assignment_error="$(mktemp)"
                if asc_request POST "/v1/betaTesters/$candidate_id/relationships/betaGroups" "$group_link" >/dev/null 2>"$assignment_error"; then
                  rm -f "$assignment_error"
                  tester_id="$candidate_id"
                  echo "Added $tester_email to the Hunger internal group."
                  break
                fi
                rm -f "$assignment_error"
              done
              if [[ -z "$tester_id" ]]; then
                create_response=""
                create_error="$(mktemp)"
                if create_response="$(asc_request POST '/v1/betaTesters' "$create_body" 2>"$create_error")"; then
                  rm -f "$create_error"
                  tester_id="$(jq -r '.data.id' <<< "$create_response")"
                  echo "Created a Hunger-scoped internal beta tester for $tester_email."
                else
                  rm -f "$create_error"
                  jq -r '.errors[]? | "Apple: \(.code) — \(.detail)"' <<< "$create_response" >&2
                  echo "Apple rejected every existing and new TestFlight identity for $tester_email." >&2
                  echo "Add this user once in App Store Connect → TestFlight → Internal → Invite Testers, then rerun the command." >&2
                  exit 2
                fi
              fi
            fi

            group_testers="$(asc_request GET "/v1/betaGroups/$group_id/betaTesters?limit=200")"
            if ! jq -e --arg id "$tester_id" '.data[] | select(.id == $id)' <<< "$group_testers" >/dev/null; then
              echo "Apple did not confirm $tester_email in the Hunger internal group." >&2
              exit 1
            fi
            group_builds="$(asc_request GET "/v1/betaGroups/$group_id/builds?limit=200")"
            testing_builds="$(jq '[.data[] | select(.attributes.processingState == "VALID")] | length' <<< "$group_builds")"
            printf 'internal_tester=%s\nroles=%s\nvalid_group_builds=%s\n' "$tester_email" "$user_roles" "$testing_builds"
          '';
        };

        iosTestflightExternalPreflight = pkgs.writeShellApplication {
          name = "hunger-ios-testflight-external-preflight";
          runtimeInputs = commonInputs;
          text = ''
            ${darwinGuard}
            ${repoGuard}
            ${testflightCommon}
            state_path="$repo_root/.artifacts/ios/testflight-bootstrap.json"
            if [[ ! -f "$state_path" ]]; then
              echo "Run: nix run .#ios-testflight-bootstrap" >&2
              exit 1
            fi
            app_id="$(jq -r '.appId' "$state_path")"
            latest_build="$(asc_request GET "/v1/builds?filter%5Bapp%5D=$app_id&sort=-uploadedDate&limit=1")"
            build_id="$(jq -r '.data[0].id // empty' <<< "$latest_build")"
            if [[ -z "$build_id" ]]; then
              echo "No Hunger build is available in App Store Connect." >&2
              exit 1
            fi
            beta_detail="$(asc_request GET "/v1/buildBetaDetails?filter%5Bbuild%5D=$build_id&limit=1")"
            localizations="$(asc_request GET "/v1/betaAppLocalizations?filter%5Bapp%5D=$app_id&limit=200")"
            related_localizations="$(asc_request GET "/v1/apps/$app_id/betaAppLocalizations?limit=200")"
            build_localizations="$(asc_request GET "/v1/betaBuildLocalizations?filter%5Bbuild%5D=$build_id&limit=200")"
            app_detail="$(asc_request GET "/v1/apps/$app_id")"
            review_detail="$(asc_request GET "/v1/apps/$app_id/betaAppReviewDetail")"
            submissions="$(asc_request GET "/v1/betaAppReviewSubmissions?filter%5Bbuild%5D=$build_id&limit=200")"
            external_groups="$(asc_request GET "/v1/betaGroups?filter%5Bapp%5D=$app_id&filter%5BisInternalGroup%5D=false&limit=200")"

            printf 'build_number=%s\n' "$(jq -r '.data[0].attributes.version' <<< "$latest_build")"
            printf 'build_processing_state=%s\n' "$(jq -r '.data[0].attributes.processingState' <<< "$latest_build")"
            printf 'external_build_state=%s\n' "$(jq -r '.data[0].attributes.externalBuildState // "NOT_VISIBLE"' <<< "$beta_detail")"
            printf 'beta_localizations=%s\n' "$(jq '.data | length' <<< "$localizations")"
            printf 'beta_localization_locales=%s\n' "$(jq -c '[.data[].attributes.locale]' <<< "$localizations")"
            printf 'related_beta_localizations=%s\n' "$(jq '.data | length' <<< "$related_localizations")"
            printf 'primary_locale=%s\n' "$(jq -r '.data.attributes.primaryLocale' <<< "$app_detail")"
            printf 'beta_build_localizations=%s\n' "$(jq -c '[.data[].attributes.locale]' <<< "$build_localizations")"
            printf 'complete_beta_localizations=%s\n' "$(jq '[.data[] | select((.attributes.description // "") != "" and (.attributes.feedbackEmail // "") != "")] | length' <<< "$localizations")"
            printf 'review_contact_complete=%s\n' "$(jq '[.data.attributes.contactFirstName,.data.attributes.contactLastName,.data.attributes.contactPhone,.data.attributes.contactEmail] | all(. != null and . != "")' <<< "$review_detail")"
            printf 'demo_account_required=%s\n' "$(jq -r '.data.attributes.demoAccountRequired // false' <<< "$review_detail")"
            printf 'review_submissions=%s\n' "$(jq -c '[.data[].attributes.betaReviewState]' <<< "$submissions")"
            printf 'external_groups=%s\n' "$(jq -c '[.data[] | {name:.attributes.name,publicLinkEnabled:.attributes.publicLinkEnabled,hasAccessToAllBuilds:.attributes.hasAccessToAllBuilds}]' <<< "$external_groups")"

            player_config="''${HUNGER_TESTFLIGHT_SOURCE_CONFIG:-$HOME/.config/player/testflight.env}"
            if [[ -f "$player_config" ]]; then
              # shellcheck disable=SC1090
              source "$player_config"
              if [[ -n "''${PLAYER_ASC_APP_BUNDLE_ID:-}" ]]; then
                player_bundle="$(url_encode "$PLAYER_ASC_APP_BUNDLE_ID")"
                player_app="$(asc_request GET "/v1/apps?filter%5BbundleId%5D=$player_bundle&limit=1")"
                player_app_id="$(jq -r '.data[0].id // empty' <<< "$player_app")"
                if [[ -n "$player_app_id" ]]; then
                  player_review="$(asc_request GET "/v1/apps/$player_app_id/betaAppReviewDetail")"
                  printf 'reusable_player_review_contact=%s\n' "$(jq '[.data.attributes.contactFirstName,.data.attributes.contactLastName,.data.attributes.contactPhone,.data.attributes.contactEmail] | all(. != null and . != "")' <<< "$player_review")"
                fi
              fi
            fi
          '';
        };

        iosTestflightExternalSubmit = pkgs.writeShellApplication {
          name = "hunger-ios-testflight-external-submit";
          runtimeInputs = commonInputs;
          text = ''
            ${darwinGuard}
            ${repoGuard}
            ${testflightCommon}
            metadata_path="$repo_root/ios/TestFlight/external-beta.json"
            state_path="$repo_root/.artifacts/ios/testflight-bootstrap.json"
            artifact_root="$repo_root/.artifacts/ios/testflight"
            if [[ ! -f "$metadata_path" || ! -f "$state_path" ]]; then
              echo "External beta metadata or App Store Connect bootstrap state is missing." >&2
              exit 1
            fi
            if ! jq -e '
              (.locale | type == "string" and length > 0) and
              (.description | type == "string" and length > 0) and
              (.feedbackEmail | type == "string" and test("@")) and
              (.whatToTest | type == "string" and length > 0) and
              (.reviewNotes | type == "string" and length > 0) and
              (.externalGroup.name | type == "string" and length > 0) and
              (.externalGroup.publicLinkLimit | type == "number" and . >= 1 and . <= 10000)
            ' "$metadata_path" >/dev/null; then
              echo "External beta metadata is incomplete or invalid." >&2
              exit 1
            fi

            app_id="$(jq -r '.appId' "$state_path")"
            locale="$(jq -r '.locale' "$metadata_path")"
            description="$(jq -r '.description' "$metadata_path")"
            feedback_email="$(jq -r '.feedbackEmail' "$metadata_path")"
            what_to_test="$(jq -r '.whatToTest' "$metadata_path")"
            review_notes="$(jq -r '.reviewNotes' "$metadata_path")"
            group_name="$(jq -r '.externalGroup.name' "$metadata_path")"
            app_detail="$(asc_request GET "/v1/apps/$app_id")"
            primary_locale="$(jq -r '.data.attributes.primaryLocale' <<< "$app_detail")"
            locales=("$primary_locale")
            if [[ "$locale" != "$primary_locale" ]]; then
              locales+=("$locale")
            fi

            latest_build="$(asc_request GET "/v1/builds?filter%5Bapp%5D=$app_id&sort=-uploadedDate&limit=1")"
            build_id="$(jq -r '.data[0].id // empty' <<< "$latest_build")"
            build_number="$(jq -r '.data[0].attributes.version // empty' <<< "$latest_build")"
            processing_state="$(jq -r '.data[0].attributes.processingState // empty' <<< "$latest_build")"
            if [[ -z "$build_id" || "$processing_state" != "VALID" ]]; then
              echo "The latest Hunger build is not valid for beta review." >&2
              exit 1
            fi
            beta_detail="$(asc_request GET "/v1/buildBetaDetails?filter%5Bbuild%5D=$build_id&limit=1")"
            external_state="$(jq -r '.data[0].attributes.externalBuildState // "NOT_VISIBLE"' <<< "$beta_detail")"
            case "$external_state" in
              READY_FOR_BETA_SUBMISSION|WAITING_FOR_BETA_REVIEW|IN_BETA_REVIEW|BETA_APPROVED|READY_FOR_BETA_TESTING) ;;
              *) echo "Build $build_number cannot enter beta review from state $external_state." >&2; exit 1 ;;
            esac

            player_config="''${HUNGER_TESTFLIGHT_SOURCE_CONFIG:-$HOME/.config/player/testflight.env}"
            if [[ ! -f "$player_config" ]]; then
              echo "The reusable Player App Store Connect handoff is missing." >&2
              exit 1
            fi
            # shellcheck disable=SC1090
            source "$player_config"
            if [[ -z "''${PLAYER_ASC_APP_BUNDLE_ID:-}" ]]; then
              echo "The Player handoff has no source bundle ID for review contact reuse." >&2
              exit 1
            fi
            player_bundle="$(url_encode "$PLAYER_ASC_APP_BUNDLE_ID")"
            player_app="$(asc_request GET "/v1/apps?filter%5BbundleId%5D=$player_bundle&limit=1")"
            player_app_id="$(jq -r '.data[0].id // empty' <<< "$player_app")"
            if [[ -z "$player_app_id" ]]; then
              echo "The source Player app is unavailable in App Store Connect." >&2
              exit 1
            fi
            player_review="$(asc_request GET "/v1/apps/$player_app_id/betaAppReviewDetail")"
            if ! jq -e '[.data.attributes.contactFirstName,.data.attributes.contactLastName,.data.attributes.contactPhone,.data.attributes.contactEmail] | all(. != null and . != "")' <<< "$player_review" >/dev/null; then
              echo "The source Player beta review contact is incomplete." >&2
              exit 1
            fi

            review_detail="$(asc_request GET "/v1/apps/$app_id/betaAppReviewDetail")"
            review_id="$(jq -r '.data.id' <<< "$review_detail")"
            review_body="$(jq -nc \
              --arg id "$review_id" \
              --arg firstName "$(jq -r '.data.attributes.contactFirstName' <<< "$player_review")" \
              --arg lastName "$(jq -r '.data.attributes.contactLastName' <<< "$player_review")" \
              --arg phone "$(jq -r '.data.attributes.contactPhone' <<< "$player_review")" \
              --arg email "$(jq -r '.data.attributes.contactEmail' <<< "$player_review")" \
              --arg notes "$review_notes" \
              '{data:{type:"betaAppReviewDetails",id:$id,attributes:{contactFirstName:$firstName,contactLastName:$lastName,contactPhone:$phone,contactEmail:$email,demoAccountRequired:false,notes:$notes}}}')"
            asc_request PATCH "/v1/betaAppReviewDetails/$review_id" "$review_body" >/dev/null
            echo "Updated private beta review contact and instructions."

            app_localizations="$(asc_request GET "/v1/betaAppLocalizations?filter%5Bapp%5D=$app_id&limit=200")"
            for localization_locale in "''${locales[@]}"; do
              app_localization_id="$(jq -r --arg locale "$localization_locale" '.data[] | select(.attributes.locale == $locale) | .id' <<< "$app_localizations" | head -n 1)"
              if [[ -z "$app_localization_id" ]]; then
                app_localization_body="$(jq -nc \
                  --arg locale "$localization_locale" --arg description "$description" --arg feedbackEmail "$feedback_email" --arg appId "$app_id" \
                  '{data:{type:"betaAppLocalizations",attributes:{locale:$locale,description:$description,feedbackEmail:$feedbackEmail},relationships:{app:{data:{type:"apps",id:$appId}}}}}')"
                app_localization="$(asc_request POST '/v1/betaAppLocalizations' "$app_localization_body")"
                app_localization_id="$(jq -r '.data.id' <<< "$app_localization")"
                echo "Created $localization_locale beta app information."
              else
                app_localization_body="$(jq -nc \
                  --arg id "$app_localization_id" --arg description "$description" --arg feedbackEmail "$feedback_email" \
                  '{data:{type:"betaAppLocalizations",id:$id,attributes:{description:$description,feedbackEmail:$feedbackEmail}}}')"
                asc_request PATCH "/v1/betaAppLocalizations/$app_localization_id" "$app_localization_body" >/dev/null
                echo "Updated $localization_locale beta app information."
              fi
            done

            build_localizations="$(asc_request GET "/v1/betaBuildLocalizations?filter%5Bbuild%5D=$build_id&limit=200")"
            for localization_locale in "''${locales[@]}"; do
              build_localization_id="$(jq -r --arg locale "$localization_locale" '.data[] | select(.attributes.locale == $locale) | .id' <<< "$build_localizations" | head -n 1)"
              if [[ -z "$build_localization_id" ]]; then
                build_localization_body="$(jq -nc \
                  --arg locale "$localization_locale" --arg whatsNew "$what_to_test" --arg buildId "$build_id" \
                  '{data:{type:"betaBuildLocalizations",attributes:{locale:$locale,whatsNew:$whatsNew},relationships:{build:{data:{type:"builds",id:$buildId}}}}}')"
                build_localization="$(asc_request POST '/v1/betaBuildLocalizations' "$build_localization_body")"
                build_localization_id="$(jq -r '.data.id' <<< "$build_localization")"
                echo "Created $localization_locale What to Test information."
              else
                build_localization_body="$(jq -nc \
                  --arg id "$build_localization_id" --arg whatsNew "$what_to_test" \
                  '{data:{type:"betaBuildLocalizations",id:$id,attributes:{whatsNew:$whatsNew}}}')"
                asc_request PATCH "/v1/betaBuildLocalizations/$build_localization_id" "$build_localization_body" >/dev/null
                echo "Updated $localization_locale What to Test information."
              fi
            done

            external_groups="$(asc_request GET "/v1/betaGroups?filter%5Bapp%5D=$app_id&filter%5BisInternalGroup%5D=false&limit=200")"
            group_id="$(jq -r --arg name "$group_name" '.data[] | select(.attributes.name == $name) | .id' <<< "$external_groups" | head -n 1)"
            if [[ -z "$group_id" ]]; then
              group_body="$(jq -nc --arg name "$group_name" --arg appId "$app_id" \
                '{data:{type:"betaGroups",attributes:{name:$name,isInternalGroup:false,feedbackEnabled:true,hasAccessToAllBuilds:false},relationships:{app:{data:{type:"apps",id:$appId}}}}}')"
              group="$(asc_request POST '/v1/betaGroups' "$group_body")"
              group_id="$(jq -r '.data.id' <<< "$group")"
              echo "Created the $group_name external group."
            else
              echo "Reusing the $group_name external group."
            fi

            group_builds="$(asc_request GET "/v1/betaGroups/$group_id/relationships/builds?limit=200")"
            if ! jq -e --arg id "$build_id" '.data[] | select(.id == $id)' <<< "$group_builds" >/dev/null; then
              build_link="$(jq -nc --arg id "$build_id" '{data:[{type:"builds",id:$id}]}')"
              asc_request POST "/v1/betaGroups/$group_id/relationships/builds" "$build_link" >/dev/null
              echo "Added build $build_number to the $group_name group."
            fi

            submissions="$(asc_request GET "/v1/betaAppReviewSubmissions?filter%5Bbuild%5D=$build_id&limit=200")"
            submission_id="$(jq -r '.data[0].id // empty' <<< "$submissions")"
            review_state="$(jq -r '.data[0].attributes.betaReviewState // empty' <<< "$submissions")"
            if [[ -z "$submission_id" ]]; then
              submission_body="$(jq -nc --arg buildId "$build_id" \
                '{data:{type:"betaAppReviewSubmissions",relationships:{build:{data:{type:"builds",id:$buildId}}}}}')"
              submission=""
              submission_error="$(mktemp)"
              if ! submission="$(asc_request POST '/v1/betaAppReviewSubmissions' "$submission_body" 2>"$submission_error")"; then
                rm -f "$submission_error"
                jq -r '.errors[]? | "Apple: \(.code) — \(.detail)"' <<< "$submission" >&2
                echo "Apple did not accept build $build_number for beta review." >&2
                exit 1
              fi
              rm -f "$submission_error"
              submission_id="$(jq -r '.data.id' <<< "$submission")"
              review_state="$(jq -r '.data.attributes.betaReviewState' <<< "$submission")"
              echo "Submitted build $build_number for TestFlight Beta App Review."
            else
              echo "Build $build_number already has a beta review submission."
            fi

            mkdir -p "$artifact_root"
            jq -n \
              --arg appId "$app_id" --arg buildId "$build_id" --arg buildNumber "$build_number" \
              --arg betaGroupId "$group_id" --arg submissionId "$submission_id" --arg betaReviewState "$review_state" \
              --arg gitCommit "$(git rev-parse HEAD)" \
              '{appId:$appId,buildId:$buildId,buildNumber:$buildNumber,betaGroupId:$betaGroupId,submissionId:$submissionId,betaReviewState:$betaReviewState,gitCommit:$gitCommit}' \
              > "$artifact_root/external-review.json"
            printf 'beta_review_state=%s\n' "$review_state"
          '';
        };

        iosTestflightExternalPublish = pkgs.writeShellApplication {
          name = "hunger-ios-testflight-external-publish";
          runtimeInputs = commonInputs;
          text = ''
            ${darwinGuard}
            ${repoGuard}
            ${testflightCommon}
            metadata_path="$repo_root/ios/TestFlight/external-beta.json"
            state_path="$repo_root/.artifacts/ios/testflight-bootstrap.json"
            app_id="$(jq -r '.appId' "$state_path")"
            group_name="$(jq -r '.externalGroup.name' "$metadata_path")"
            public_link_limit="$(jq -r '.externalGroup.publicLinkLimit' "$metadata_path")"
            latest_build="$(asc_request GET "/v1/builds?filter%5Bapp%5D=$app_id&sort=-uploadedDate&limit=1")"
            build_id="$(jq -r '.data[0].id // empty' <<< "$latest_build")"
            build_number="$(jq -r '.data[0].attributes.version // empty' <<< "$latest_build")"
            submissions="$(asc_request GET "/v1/betaAppReviewSubmissions?filter%5Bbuild%5D=$build_id&limit=200")"
            review_state="$(jq -r '.data[0].attributes.betaReviewState // "NOT_SUBMITTED"' <<< "$submissions")"
            if [[ "$review_state" != "APPROVED" ]]; then
              echo "Build $build_number beta review state: $review_state"
              echo "The public link will remain disabled until Apple approves the build." >&2
              exit 2
            fi
            external_groups="$(asc_request GET "/v1/betaGroups?filter%5Bapp%5D=$app_id&filter%5BisInternalGroup%5D=false&limit=200")"
            group_id="$(jq -r --arg name "$group_name" '.data[] | select(.attributes.name == $name) | .id' <<< "$external_groups" | head -n 1)"
            if [[ -z "$group_id" ]]; then
              echo "The $group_name external group is missing." >&2
              exit 1
            fi
            group_body="$(jq -nc --arg id "$group_id" --argjson limit "$public_link_limit" \
              '{data:{type:"betaGroups",id:$id,attributes:{publicLinkEnabled:true,publicLinkLimitEnabled:true,publicLinkLimit:$limit,feedbackEnabled:true}}}')"
            asc_request PATCH "/v1/betaGroups/$group_id" "$group_body" >/dev/null
            group="$(asc_request GET "/v1/betaGroups/$group_id")"
            public_link="$(jq -r '.data.attributes.publicLink // empty' <<< "$group")"
            if [[ -z "$public_link" || "$(jq -r '.data.attributes.publicLinkEnabled' <<< "$group")" != "true" ]]; then
              echo "Apple approved the build but did not enable its public link." >&2
              exit 1
            fi
            printf 'beta_review_state=%s\npublic_link=%s\npublic_link_limit=%s\n' "$review_state" "$public_link" "$public_link_limit"
          '';
        };

        iosTestflightFinalize = pkgs.writeShellApplication {
          name = "hunger-ios-testflight-finalize";
          runtimeInputs = commonInputs;
          text = ''
            ${darwinGuard}
            ${repoGuard}
            ${testflightCommon}
            state_path="$repo_root/.artifacts/ios/testflight-bootstrap.json"
            artifact_root="$repo_root/.artifacts/ios/testflight"
            if [[ ! -f "$state_path" ]]; then
              echo "App Store Connect bootstrap state is missing." >&2
              echo "Run: nix run .#ios-testflight-bootstrap" >&2
              exit 1
            fi
            mkdir -p "$artifact_root"

            app_id="$(jq -r '.appId' "$state_path")"
            group_id="$(jq -r '.betaGroupId' "$state_path")"
            tester_id="$(jq -r '.betaTesterId' "$state_path")"
            build_number="''${HUNGER_TESTFLIGHT_BUILD_NUMBER:-}"
            git_commit="''${HUNGER_TESTFLIGHT_GIT_COMMIT:-$(git rev-parse HEAD)}"
            marketing_version="$(awk -F ': ' '/MARKETING_VERSION:/ {gsub(/"/, "", $2); print $2; exit}' "$repo_root/ios/project.yml")"

            if [[ -z "$build_number" ]]; then
              latest_response="$(asc_request GET "/v1/builds?filter%5Bapp%5D=$app_id&sort=-uploadedDate&limit=1")"
              build_number="$(jq -r '.data[0].attributes.version // empty' <<< "$latest_response")"
            fi
            if [[ ! "$build_number" =~ ^[1-9][0-9]*$ ]]; then
              echo "No uploaded TestFlight build is available to finalize." >&2
              exit 1
            fi
            echo "Finalizing TestFlight $marketing_version ($build_number)."

            deadline=$((SECONDS + 3600))
            build_id=""
            processing_state=""
            while (( SECONDS < deadline )); do
              encoded_build="$(url_encode "$build_number")"
              processed_response="$(asc_request GET "/v1/builds?filter%5Bapp%5D=$app_id&filter%5Bversion%5D=$encoded_build&sort=-uploadedDate&limit=1")"
              build_id="$(jq -r '.data[0].id // empty' <<< "$processed_response")"
              processing_state="$(jq -r '.data[0].attributes.processingState // "NOT_VISIBLE"' <<< "$processed_response")"
              printf 'App Store Connect processing state: %s\n' "$processing_state"
              case "$processing_state" in
                VALID) break ;;
                FAILED|INVALID) echo "Apple rejected the uploaded build during processing." >&2; exit 1 ;;
              esac
              sleep 30
            done
            if [[ -z "$build_id" || "$processing_state" != "VALID" ]]; then
              echo "Timed out waiting for the uploaded build to finish processing." >&2
              exit 1
            fi

            group_builds="$(asc_request GET "/v1/betaGroups/$group_id/relationships/builds?limit=200")"
            if ! jq -e --arg id "$build_id" '.data[] | select(.id == $id)' <<< "$group_builds" >/dev/null; then
              build_link="$(jq -nc --arg id "$build_id" '{data:[{type:"builds",id:$id}]}')"
              asc_request POST "/v1/betaGroups/$group_id/relationships/builds" "$build_link" >/dev/null
              echo "Added processed build to the internal group."
            fi

            group_testers="$(asc_request GET "/v1/betaGroups/$group_id/relationships/betaTesters?limit=200")"
            if [[ "$(jq '.data | length' <<< "$group_testers")" != "0" ]]; then
              tester_id="$(jq -r '.data[0].id' <<< "$group_testers")"
              echo "Reusing the internal tester selected in App Store Connect."
            elif ! jq -e --arg id "$tester_id" '.data[] | select(.id == $id)' <<< "$group_testers" >/dev/null; then
              tester_link="$(jq -nc --arg id "$tester_id" '{data:[{type:"betaTesters",id:$id}]}')"
              group_link="$(jq -nc --arg id "$group_id" '{data:[{type:"betaGroups",id:$id}]}')"
              tester_deadline=$((SECONDS + 600))
              while (( SECONDS < tester_deadline )); do
                tester_response=""
                tester_error="$(mktemp)"
                if tester_response="$(asc_request POST "/v1/betaGroups/$group_id/relationships/betaTesters" "$tester_link" 2>"$tester_error")"; then
                  rm -f "$tester_error"
                  echo "Added configured tester to the internal group."
                  break
                fi
                rm -f "$tester_error"
                tester_status="$(jq -r '.errors[0].status // empty' <<< "$tester_response")"
                if [[ "$tester_status" != "409" ]]; then
                  jq -r '.errors[]? | "Apple: \(.code) — \(.detail)"' <<< "$tester_response" >&2
                  echo "Apple rejected the tester-group assignment." >&2
                  exit 1
                fi
                alternate_response=""
                alternate_error="$(mktemp)"
                if alternate_response="$(asc_request POST "/v1/betaTesters/$tester_id/relationships/betaGroups" "$group_link" 2>"$alternate_error")"; then
                  rm -f "$alternate_error"
                  echo "Added configured tester through the tester-group relationship."
                  break
                fi
                rm -f "$alternate_error"
                alternate_status="$(jq -r '.errors[0].status // empty' <<< "$alternate_response")"
                if [[ "$alternate_status" != "409" ]]; then
                  jq -r '.errors[]? | "Apple: \(.code) — \(.detail)"' <<< "$alternate_response" >&2
                  echo "Apple rejected the alternate tester-group assignment." >&2
                  exit 1
                fi
                tester_code="$(jq -r '.errors[0].code // "STATE_CONFLICT"' <<< "$tester_response")"
                tester_detail="$(jq -r '.errors[0].detail // "The relationship is not ready."' <<< "$tester_response")"
                printf 'Apple: %s — %s\n' "$tester_code" "$tester_detail"
                echo "Tester assignment is not ready yet; retrying after Apple propagates the build."
                sleep 15
              done
              group_testers="$(asc_request GET "/v1/betaGroups/$group_id/relationships/betaTesters?limit=200")"
              if ! jq -e --arg id "$tester_id" '.data[] | select(.id == $id)' <<< "$group_testers" >/dev/null; then
                echo "Timed out assigning the configured tester to the internal group." >&2
                exit 1
              fi
            fi

            beta_state=""
            deadline=$((SECONDS + 900))
            while (( SECONDS < deadline )); do
              beta_response="$(asc_request GET "/v1/buildBetaDetails?filter%5Bbuild%5D=$build_id&limit=1")"
              beta_state="$(jq -r '.data[0].attributes.internalBuildState // "NOT_VISIBLE"' <<< "$beta_response")"
              printf 'Internal TestFlight state: %s\n' "$beta_state"
              [[ "$beta_state" == "IN_BETA_TESTING" ]] && break
              case "$beta_state" in
                PROCESSING_EXCEPTION|MISSING_EXPORT_COMPLIANCE) \
                  echo "Build requires App Store Connect intervention: $beta_state" >&2; exit 1 ;;
              esac
              sleep 20
            done
            if [[ "$beta_state" != "IN_BETA_TESTING" ]]; then
              echo "Timed out waiting for internal TestFlight distribution." >&2
              exit 1
            fi

            jq -n \
              --arg appId "$app_id" \
              --arg buildId "$build_id" \
              --arg betaGroupId "$group_id" \
              --arg marketingVersion "$marketing_version" \
              --arg buildNumber "$build_number" \
              --arg processingState "$processing_state" \
              --arg internalBuildState "$beta_state" \
              --arg gitCommit "$git_commit" \
              '{appId:$appId,buildId:$buildId,betaGroupId:$betaGroupId,marketingVersion:$marketingVersion,buildNumber:$buildNumber,processingState:$processingState,internalBuildState:$internalBuildState,gitCommit:$gitCommit}' \
              > "$artifact_root/release.json"
            echo "TestFlight $marketing_version ($build_number) is available to the selected internal tester."
          '';
        };

        iosTestflightRelease = pkgs.writeShellApplication {
          name = "hunger-ios-testflight-release";
          runtimeInputs = commonInputs ++ darwinInputs;
          text = ''
            ${darwinGuard}
            ${repoGuard}
            ${testflightCommon}
            ${lib.getExe iosTestflightBootstrap}

            artifact_root="$repo_root/.artifacts/ios/testflight"
            archive_path="$artifact_root/Hunger.xcarchive"
            export_path="$artifact_root/export"
            export_options="$artifact_root/ExportOptions.plist"
            result_bundle="$artifact_root/Archive.xcresult"
            mkdir -p "$artifact_root"
            case "$archive_path" in "$repo_root/.artifacts/ios/testflight/"*) ;; *) exit 1 ;; esac
            case "$export_path" in "$repo_root/.artifacts/ios/testflight/"*) ;; *) exit 1 ;; esac
            rm -rf "$archive_path" "$export_path" "$result_bundle"

            state_path="$repo_root/.artifacts/ios/testflight-bootstrap.json"
            app_id="$(jq -r '.appId' "$state_path")"
            builds_response="$(asc_request GET "/v1/builds?filter%5Bapp%5D=$app_id&limit=200")"
            build_number="$(jq '([.data[].attributes.version | tonumber? // 0] | max // 0) + 1' <<< "$builds_response")"
            marketing_version="$(awk -F ': ' '/MARKETING_VERSION:/ {gsub(/"/, "", $2); print $2; exit}' "$repo_root/ios/project.yml")"
            if [[ ! "$build_number" =~ ^[1-9][0-9]*$ || -z "$marketing_version" ]]; then
              echo "Could not determine the next TestFlight version and build number." >&2
              exit 1
            fi
            echo "Preparing TestFlight $marketing_version ($build_number) from $(git rev-parse --short HEAD)."

            ${lib.getExe iosBuildWeb}
            ${lib.getExe iosGenerate}
            set -o pipefail
            xcodebuild archive \
              -project "$repo_root/ios/Hunger.xcodeproj" \
              -scheme Hunger \
              -configuration Release \
              -destination 'generic/platform=iOS' \
              -archivePath "$archive_path" \
              -derivedDataPath "$repo_root/.derived-data/ios-testflight" \
              -resultBundlePath "$result_bundle" \
              -allowProvisioningUpdates \
              -authenticationKeyPath "$HUNGER_ASC_KEY_PATH" \
              -authenticationKeyID "$HUNGER_ASC_KEY_ID" \
              -authenticationKeyIssuerID "$HUNGER_ASC_ISSUER_ID" \
              DEVELOPMENT_TEAM="$HUNGER_APPLE_TEAM_ID" \
              CODE_SIGN_STYLE=Automatic \
              CURRENT_PROJECT_VERSION="$build_number" \
              MARKETING_VERSION="$marketing_version" \
              | xcbeautify

            app_root="$archive_path/Products/Applications/Hunger.app"
            info_plist="$app_root/Info.plist"
            if [[ ! -d "$app_root" || ! -f "$info_plist" ]]; then
              echo "Signed archive did not contain Hunger.app." >&2
              exit 1
            fi
            archived_bundle_id="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$info_plist")"
            archived_version="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$info_plist")"
            archived_build="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleVersion' "$info_plist")"
            encryption_exempt="$(/usr/libexec/PlistBuddy -c 'Print :ITSAppUsesNonExemptEncryption' "$info_plist")"
            if [[ "$archived_bundle_id" != "$HUNGER_ASC_APP_BUNDLE_ID" || \
                  "$archived_version" != "$marketing_version" || \
                  "$archived_build" != "$build_number" || \
                  "$encryption_exempt" != "false" ]]; then
              echo "Signed archive metadata does not match the intended release." >&2
              exit 1
            fi
            ipad_orientations="$(/usr/libexec/PlistBuddy -c 'Print :UISupportedInterfaceOrientations~ipad' "$info_plist")"
            required_ipad_orientations=(
              UIInterfaceOrientationPortrait
              UIInterfaceOrientationPortraitUpsideDown
              UIInterfaceOrientationLandscapeLeft
              UIInterfaceOrientationLandscapeRight
            )
            for required_orientation in "''${required_ipad_orientations[@]}"; do
              if ! rg -q "^ *$required_orientation$" <<< "$ipad_orientations"; then
                echo "Signed archive is missing required iPad orientation: $required_orientation" >&2
                exit 1
              fi
            done
            if [[ ! -f "$app_root/PrivacyInfo.xcprivacy" || ! -f "$app_root/WebApp/asset-manifest.json" || ! -f "$app_root/Assets.car" ]]; then
              echo "Signed archive is missing privacy, offline web, or app-icon assets." >&2
              exit 1
            fi
            codesign --verify --deep --strict "$app_root"
            entitlements_path="$artifact_root/archive-entitlements.plist"
            codesign -d --entitlements :- "$app_root" > "$entitlements_path" 2>/dev/null
            if rg -q 'aps-environment|UIBackgroundModes|com\.apple\.developer\.networking' "$entitlements_path"; then
              echo "Signed archive contains an unexpected network, push, or background entitlement." >&2
              exit 1
            fi
            echo "Validated signed archive and offline payload."

            plutil -create xml1 "$export_options"
            plutil -insert method -string app-store-connect "$export_options"
            plutil -insert destination -string upload "$export_options"
            plutil -insert signingStyle -string automatic "$export_options"
            plutil -insert teamID -string "$HUNGER_APPLE_TEAM_ID" "$export_options"
            plutil -insert manageAppVersionAndBuildNumber -bool false "$export_options"
            plutil -insert uploadSymbols -bool true "$export_options"
            mkdir -p "$export_path"
            set -o pipefail
            xcodebuild -exportArchive \
              -archivePath "$archive_path" \
              -exportPath "$export_path" \
              -exportOptionsPlist "$export_options" \
              -allowProvisioningUpdates \
              -authenticationKeyPath "$HUNGER_ASC_KEY_PATH" \
              -authenticationKeyID "$HUNGER_ASC_KEY_ID" \
              -authenticationKeyIssuerID "$HUNGER_ASC_ISSUER_ID" \
              | xcbeautify
            echo "Upload accepted; waiting for App Store Connect processing."
            HUNGER_TESTFLIGHT_BUILD_NUMBER="$build_number" \
              HUNGER_TESTFLIGHT_GIT_COMMIT="$(git rev-parse HEAD)" \
              ${lib.getExe iosTestflightFinalize}
          '';
        };

        iosBuildWeb = pkgs.writeShellApplication {
          name = "hunger-ios-build-web";
          runtimeInputs = commonInputs;
          text = ''
            ${repoGuard}

            resource_root="$repo_root/ios/Hunger/Resources/WebApp"
            expected_resource_root="$repo_root/ios/Hunger/Resources/WebApp"
            if [[ "$resource_root" != "$expected_resource_root" ]]; then
              echo "Refusing to replace unexpected resource path: $resource_root" >&2
              exit 1
            fi

            VITE_NATIVE_SHELL=ios VITE_GIT_HASH="''${VITE_GIT_HASH:-native}" bun run build

            rm -rf "$resource_root"
            mkdir -p "$resource_root"
            cp -R "$repo_root/build/." "$resource_root/"
            rm -f \
              "$resource_root/service-worker.js" \
              "$resource_root/manifest.webmanifest" \
              "$resource_root/404.html"

            if rg -q '__HUNGER_E2E__|data-e2e-fixture|serviceWorker\.register' "$resource_root"; then
              echo "Development or service-worker code leaked into the native bundle." >&2
              exit 1
            fi

            manifest_tmp="$(mktemp)"
            trap 'rm -f "$manifest_tmp"' EXIT
            while IFS= read -r relative_path; do
              file_path="$resource_root/$relative_path"
              case "$relative_path" in
                *.html) mime_type="text/html" ;;
                *.css) mime_type="text/css" ;;
                *.js) mime_type="text/javascript" ;;
                *.json) mime_type="application/json" ;;
                *.svg) mime_type="image/svg+xml" ;;
                *.png) mime_type="image/png" ;;
                *.webp) mime_type="image/webp" ;;
                *.woff2) mime_type="font/woff2" ;;
                *) mime_type="application/octet-stream" ;;
              esac
              jq -nc \
                --arg path "$relative_path" \
                --arg mimeType "$mime_type" \
                --arg sha256 "$(sha256sum "$file_path" | cut -d ' ' -f 1)" \
                --argjson bytes "$(wc -c < "$file_path" | tr -d ' ')" \
                '{path: $path, mimeType: $mimeType, sha256: $sha256, bytes: $bytes}'
            done < <(
              cd "$resource_root"
              find . -type f ! -name asset-manifest.json -print \
                | sed 's#^\./##' \
                | LC_ALL=C sort
            ) | jq -s '{version: 1, files: .}' > "$manifest_tmp"
            mv "$manifest_tmp" "$resource_root/asset-manifest.json"
            trap - EXIT

            echo "Packaged $(jq '.files | length' "$resource_root/asset-manifest.json") offline web resources."
          '';
        };

        iosGenerate = pkgs.writeShellApplication {
          name = "hunger-ios-generate";
          runtimeInputs = commonInputs ++ darwinInputs;
          text = ''
            ${darwinGuard}
            ${repoGuard}
            ${lib.getExe iosGenerateAppIcon}
            if [[ ! -d "$repo_root/ios/Hunger/Resources/WebApp" ]]; then
              echo "Build the native web resources before generating the project." >&2
              exit 1
            fi
            xcodegen generate \
              --spec "$repo_root/ios/project.yml" \
              --project "$repo_root/ios"
          '';
        };

        iosXcodeTest = testTarget: pkgs.writeShellApplication {
          name = "hunger-ios-test-${testTarget}";
          runtimeInputs = commonInputs ++ darwinInputs;
          text = ''
            ${darwinGuard}
            ${repoGuard}
            ${lib.getExe iosBuildWeb}
            ${lib.getExe iosGenerate}
            destination="''${IOS_DESTINATION:-platform=iOS Simulator,name=iPhone 17,OS=latest}"
            only_testing="''${IOS_ONLY_TESTING:-Hunger${testTarget}}"
            artifact_root="$repo_root/.artifacts/ios"
            result_bundle="$artifact_root/${testTarget}.xcresult"
            mkdir -p "$artifact_root"
            rm -rf "$result_bundle"
            set -o pipefail
            xcodebuild test \
              -project "$repo_root/ios/Hunger.xcodeproj" \
              -scheme Hunger \
              -destination "$destination" \
              -derivedDataPath "$repo_root/.derived-data/ios" \
              -resultBundlePath "$result_bundle" \
              -only-testing:"$only_testing" \
              CODE_SIGNING_ALLOWED=NO \
              | xcbeautify
          '';
        };

        iosTestUnit = iosXcodeTest "Tests";
        iosTestUi = iosXcodeTest "UITests";

        iosBuildRelease = pkgs.writeShellApplication {
          name = "hunger-ios-build-release";
          runtimeInputs = commonInputs ++ darwinInputs;
          text = ''
            ${darwinGuard}
            ${repoGuard}
            ${lib.getExe iosBuildWeb}
            ${lib.getExe iosGenerate}
            artifact_root="$repo_root/.artifacts/ios"
            result_bundle="$artifact_root/ReleaseBuild.xcresult"
            mkdir -p "$artifact_root"
            rm -rf "$result_bundle"
            set -o pipefail
            xcodebuild build \
              -project "$repo_root/ios/Hunger.xcodeproj" \
              -scheme Hunger \
              -configuration Release \
              -destination "generic/platform=iOS Simulator" \
              -derivedDataPath "$repo_root/.derived-data/ios" \
              -resultBundlePath "$result_bundle" \
              CODE_SIGNING_ALLOWED=NO \
              | xcbeautify
          '';
        };

        iosAuditRelease = pkgs.writeShellApplication {
          name = "hunger-ios-audit-release";
          runtimeInputs = commonInputs ++ darwinInputs;
          text = ''
            ${darwinGuard}
            ${repoGuard}
            ${lib.getExe iosBuildRelease}

            app_root="$repo_root/.derived-data/ios/Build/Products/Release-iphonesimulator/Hunger.app"
            web_root="$app_root/WebApp"
            artifact_root="$repo_root/.artifacts/ios"
            if [[ ! -d "$app_root" || ! -d "$web_root" ]]; then
              echo "Release app or packaged WebApp resources were not produced." >&2
              exit 1
            fi
            if [[ ! -f "$app_root/PrivacyInfo.xcprivacy" ]]; then
              echo "PrivacyInfo.xcprivacy is missing from the Release app." >&2
              exit 1
            fi

            expected_files="$(mktemp)"
            actual_files="$(mktemp)"
            remote_urls="$(mktemp)"
            trap 'rm -f "$expected_files" "$actual_files" "$remote_urls"' EXIT
            jq -r '.files[].path' "$web_root/asset-manifest.json" | LC_ALL=C sort > "$expected_files"
            (
              cd "$web_root"
              find . -type f ! -name asset-manifest.json -print \
                | sed 's#^\./##' \
                | LC_ALL=C sort
            ) > "$actual_files"
            if ! diff -u "$expected_files" "$actual_files"; then
              echo "Release web resources do not match their integrity manifest." >&2
              exit 1
            fi

            if find "$web_root" -type f \( -name '*.map' -o -name 'service-worker.js' -o -name 'manifest.webmanifest' -o -name '404.html' \) | rg -q .; then
              echo "A development-only resource leaked into the Release app." >&2
              exit 1
            fi
            if rg -q '__HUNGER_E2E__|data-e2e-fixture|serviceWorker\.register' "$web_root"; then
              echo "A fixture or service-worker symbol leaked into the Release app." >&2
              exit 1
            fi
            rg -o --no-filename 'https?://[^"[:space:]<>]+' "$web_root" | LC_ALL=C sort -u > "$remote_urls" || true
            while IFS= read -r url; do
              case "$url" in
                http://www.w3.org/1999/xhtml|http://www.w3.org/2000/svg|https://svelte.dev/e/*) ;;
                *) echo "Unexpected remote URL in Release payload: $url" >&2; exit 1 ;;
              esac
            done < "$remote_urls"
            if rg -q 'aps-environment|UIBackgroundModes|com\.apple\.developer\.networking' \
              "$repo_root/ios/Hunger.xcodeproj/project.pbxproj"; then
              echo "An unexpected background, push, or networking entitlement is configured." >&2
              exit 1
            fi

            cp "$web_root/asset-manifest.json" "$artifact_root/release-asset-manifest.json"
            (
              cd "$app_root"
              find . -type f -print | sed 's#^\./##' | LC_ALL=C sort
            ) > "$artifact_root/release-app-files.txt"
            echo "Audited offline Release app at $app_root"
          '';
        };

        iosVerify = pkgs.writeShellApplication {
          name = "hunger-ios-verify";
          runtimeInputs = commonInputs ++ darwinInputs;
          text = ''
            ${darwinGuard}
            ${repoGuard}
            bun install --frozen-lockfile
            bun run check
            bun run test:unit
            ${lib.getExe iosBuildWeb}
            ${lib.getExe iosGenerate}
            git diff --exit-code -- ios/Hunger.xcodeproj
            ${lib.getExe iosTestUnit}
            ${lib.getExe iosTestUi}
            ${lib.getExe iosAuditRelease}
            git diff --check
          '';
        };
      in {
        apps = {
          ios-build-web = flake-utils.lib.mkApp { drv = iosBuildWeb; };
          ios-generate-app-icon = flake-utils.lib.mkApp { drv = iosGenerateAppIcon; };
          ios-generate = flake-utils.lib.mkApp { drv = iosGenerate; };
          ios-test-unit = flake-utils.lib.mkApp { drv = iosTestUnit; };
          ios-test-ui = flake-utils.lib.mkApp { drv = iosTestUi; };
          ios-build-release = flake-utils.lib.mkApp { drv = iosBuildRelease; };
          ios-audit-release = flake-utils.lib.mkApp { drv = iosAuditRelease; };
          ios-verify = flake-utils.lib.mkApp { drv = iosVerify; };
          ios-testflight-configure = flake-utils.lib.mkApp { drv = iosTestflightConfigure; };
          ios-testflight-preflight = flake-utils.lib.mkApp { drv = iosTestflightPreflight; };
          ios-testflight-bootstrap = flake-utils.lib.mkApp { drv = iosTestflightBootstrap; };
          ios-testflight-add-tester = flake-utils.lib.mkApp { drv = iosTestflightAddTester; };
          ios-testflight-external-preflight = flake-utils.lib.mkApp { drv = iosTestflightExternalPreflight; };
          ios-testflight-external-submit = flake-utils.lib.mkApp { drv = iosTestflightExternalSubmit; };
          ios-testflight-external-publish = flake-utils.lib.mkApp { drv = iosTestflightExternalPublish; };
          ios-testflight-finalize = flake-utils.lib.mkApp { drv = iosTestflightFinalize; };
          ios-testflight-release = flake-utils.lib.mkApp { drv = iosTestflightRelease; };
        };

        devShells.default = pkgs.mkShell {
          packages = with pkgs; [
            # Build and verify the static SvelteKit application.
            bun
            nodejs_24
            playwright-driver.browsers

            # Inspect, extract text/images, and render PDF pages.
            poppler-utils
            qpdf

            # OCR scanned or image-only documents.
            ocrmypdf
            tesseract

            # Inspect and convert source images and rendered pages.
            imagemagick
            exiftool
            ghostscript
          ] ++ darwinInputs;

          shellHook = ''
            export PLAYWRIGHT_BROWSERS_PATH=${pkgs.playwright-driver.browsers}
            export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
            if [[ "$(uname -s)" == "Darwin" && -d "/Applications/Xcode.app/Contents/Developer" ]]; then
              export DEVELOPER_DIR="''${HUNGER_DEVELOPER_DIR:-/Applications/Xcode.app/Contents/Developer}"
              export PATH="/usr/bin:/bin:/usr/sbin:/sbin:$PATH"
            fi
            echo "Learn Your Appetite environment ready: Bun, Playwright, PDF/OCR, and iOS tools"
          '';
        };
      });
}
