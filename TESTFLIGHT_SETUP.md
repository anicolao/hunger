# TestFlight release automation

Hunger's TestFlight release is a single flake-managed workflow after one
App Store Connect web form. It registers the fixed bundle ID, reuses the app
record, creates or reuses the internal group, archives with automatic signing,
validates the signed offline payload, uploads it, waits for Apple processing,
and assigns it to the configured internal tester.

The permanent release identity is:

- app name: `Learn Your Appetite`;
- bundle ID: `com.anicolao.hunger`;
- SKU: `hunger-ios`;
- primary locale: `en-CA`;
- marketing version source: `ios/project.yml`;
- build number: one greater than the highest build already in App Store
  Connect.

Do not change the bundle ID after users have installed a TestFlight build. It
is also part of the app's on-device persistence identity.

## Security boundary

Never paste or commit an `AuthKey_*.p8`, Apple password, two-factor code,
certificate private key, or provisioning profile. The API key remains outside
the repository and its owner-only config stores only identifiers and a path to
the key. Release artifacts under `.artifacts/` are ignored.

## One-time handoff

This machine can reuse the installed Admin team API handoff from `../player`:

```bash
nix run .#ios-testflight-configure
nix run .#ios-testflight-preflight
```

The first command writes `~/.config/hunger/testflight.env` with mode `600`; it
does not copy or print the private key. The preflight validates permissions,
the key, API access, the internal tester, and the local signing keychain without
changing Apple state.

If the Player handoff is not present, complete these manual credential steps
first:

1. Confirm Apple Developer Program membership is active and the Account Holder
   has accepted pending agreements in App Store Connect.
2. Create an App Store Connect **team** API key with Admin access and download
   its `.p8` file once. Keep it under
   `~/.appstoreconnect/private_keys/AuthKey_<KEY_ID>.p8` with mode `600`.
3. Add the intended internal tester as an App Store Connect user and enable
   TestFlight access.
4. Create an owner-only shell config matching the variables written by
   `nix run .#ios-testflight-configure`, or point
   `HUNGER_TESTFLIGHT_SOURCE_CONFIG` at an equivalent Player-format handoff and
   rerun that command.

After preflight, run `nix run .#ios-testflight-bootstrap` once. It registers
the Hunger Bundle ID through Apple's API. Apple does not expose creation of the
initial app record through the supported REST workflow, so create that one
record at <https://appstoreconnect.apple.com> using **Apps → + → New App**:

- Platforms: **iOS**
- Name: **Learn Your Appetite**
- Primary language: **English (Canada)**
- Bundle ID: **Learn Your Appetite — com.anicolao.hunger**
- SKU: **hunger-ios**
- User Access: **Full Access**

Then rerun `nix run .#ios-testflight-bootstrap`. The API automates app access,
the internal group, and every build-group relationship. A warning that App
Store Connect could not save all-user access is safe to acknowledge for an
Account Holder or Admin: Apple does not allow those roles to have app access
limited. Apple may defer or reject the first tester-group relationship until a
processed build exists. If the release reports `Tester(s) cannot be assigned`,
open the app's **TestFlight → Internal** group once, choose **Invite Testers**,
and add the intended App Store Connect user. The resumable finalizer adopts that
selection without uploading a second build. Do not manually create signing
certificates or provisioning profiles.

## Release commands

The state-changing bootstrap is idempotent and may be rerun after the app
record handoff:

```bash
nix run .#ios-testflight-bootstrap
```

Run the complete release only from a reviewed, green commit:

```bash
nix run .#ios-verify
nix run .#ios-testflight-release
```

The release is complete only when the command reports both App Store Connect
processing state `VALID` and internal state `IN_BETA_TESTING`. A safe receipt
containing the commit, version, build number, and opaque Apple resource IDs is
written to `.artifacts/ios/testflight/release.json`.

Upload and distribution are independently resumable. If Xcode has already
uploaded a build but the release stops during Apple processing or tester
assignment, resume the latest uploaded build without consuming a new build
number:

```bash
nix run .#ios-testflight-finalize
```

If the command stops for agreements, an unavailable app name, or account-role
permissions, resolve only that reported issue in Apple's portal and rerun the
same command. Automatic signing manages certificates and provisioning profiles;
do not create them by hand preemptively.

## Apple references

- [App Store Connect API keys](https://developer.apple.com/help/app-store-connect/get-started/app-store-connect-api)
- [Bundle IDs API](https://developer.apple.com/documentation/appstoreconnectapi/bundle-ids)
- [Builds API](https://developer.apple.com/documentation/appstoreconnectapi/builds)
- [Beta groups API](https://developer.apple.com/documentation/appstoreconnectapi/beta-groups)
- [Add internal testers](https://developer.apple.com/help/app-store-connect/test-a-beta-version/add-internal-testers)
