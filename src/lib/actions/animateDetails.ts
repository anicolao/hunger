import type { Action } from 'svelte/action';

const DURATION_MS = 220;

export const animateDetails: Action<HTMLDetailsElement> = (node) => {
  const summary = node.querySelector(':scope > summary');
  if (!(summary instanceof HTMLElement)) return;

  let animation: Animation | null = null;

  const clearStyles = () => {
    node.style.removeProperty('height');
    node.style.removeProperty('overflow');
    node.style.removeProperty('will-change');
  };

  const toggle = (event: MouseEvent) => {
    if (!summary.contains(event.target as Node)) return;
    event.preventDefault();

    animation?.cancel();
    animation = null;

    const opening = !node.open;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || !node.animate) {
      node.open = opening;
      return;
    }

    const startHeight = node.offsetHeight;
    if (opening) node.open = true;
    const endHeight = opening ? node.offsetHeight : summary.offsetHeight;

    node.style.height = `${startHeight}px`;
    node.style.overflow = 'clip';
    node.style.willChange = 'height';
    animation = node.animate(
      { height: [`${startHeight}px`, `${endHeight}px`] },
      { duration: DURATION_MS, easing: 'cubic-bezier(.2, .75, .25, 1)' }
    );
    animation.onfinish = () => {
      if (!opening) node.open = false;
      animation = null;
      clearStyles();
    };
    animation.oncancel = clearStyles;
  };

  summary.addEventListener('click', toggle);
  return {
    destroy() {
      animation?.cancel();
      summary.removeEventListener('click', toggle);
      clearStyles();
    }
  };
};
