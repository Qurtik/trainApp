import type { Href, ImperativeRouter } from 'expo-router';

export function goBackOrReplace(router: ImperativeRouter, href: Href) {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace(href);
  }
}
