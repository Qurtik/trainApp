import { LinearGradient } from 'expo-linear-gradient';
import {
  createContext,
  ReactNode,
  RefObject,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Keyboard,
  LayoutChangeEvent,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from './Theme';

const CONTENT_BOTTOM_PADDING = 20;
const FOOTER_PADDING_CLOSED = 12;
const KEYBOARD_GAP = 15;
const VISIBLE_MARGIN = 24;
const ANDROID_HEADER_CONTENT_HEIGHT = 52;
const IOS_HEADER_OFFSET = 56;

type ScreenScrollValue = {
  ensureVisible: (target: RefObject<View | null> | View | null) => void;
};

const ScreenScrollContext = createContext<ScreenScrollValue>({
  ensureVisible: () => {},
});

export function useScreenScroll(): ScreenScrollValue {
  return useContext(ScreenScrollContext);
}

type ScreenProps = {
  loading?: boolean;
  centered?: boolean;
  footer?: ReactNode;
  children: ReactNode;
};

function resolveTarget(target: RefObject<View | null> | View | null): View | null {
  if (!target) {
    return null;
  }
  return 'current' in target ? target.current : target;
}

export function Screen({ loading, centered, footer, children }: ScreenProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const gradient = theme.gradientColors;
  const surface = gradient?.[0] ?? theme.background;
  const [keyboardTop, setKeyboardTop] = useState<number | null>(null);
  const [rootBottom, setRootBottom] = useState(0);
  const [footerContentHeight, setFooterContentHeight] = useState(0);
  const rootRef = useRef<View>(null);
  const scrollRef = useRef<ScrollView>(null);
  const footerRef = useRef<View>(null);
  const contentOffsetY = useRef(0);
  const keyboardHeightRef = useRef(0);
  const pendingTarget = useRef<View | null>(null);

  // When the window resizes for the keyboard, rootBottom already sits at the keyboard top and overlap is 0.
  const keyboardHeight = keyboardTop === null ? 0 : Math.max(0, Math.round(rootBottom - keyboardTop));

  const footerBottom = keyboardHeight > 0
    ? keyboardHeight + KEYBOARD_GAP
    : Math.max(insets.bottom, FOOTER_PADDING_CLOSED);

  const headerOffset = Platform.OS === 'android'
    ? ANDROID_HEADER_CONTENT_HEIGHT + insets.top
    : IOS_HEADER_OFFSET;

  const scrollTarget = useCallback((target: View | null) => {
    if (!target || !scrollRef.current) {
      return;
    }

    const applyScroll = (visibleBottom: number) => {
      const visibleTop = VISIBLE_MARGIN + headerOffset;
      const visibleHeight = visibleBottom - visibleTop;

      target.measureInWindow((_tx, ty, _tw, th) => {
        const cardTop = ty;
        const cardBottom = ty + th;
        let delta = 0;
        if (th > visibleHeight) {
          delta = cardTop - visibleTop;
        } else if (cardBottom > visibleBottom) {
          delta = cardBottom - visibleBottom;
        } else if (cardTop < visibleTop) {
          delta = cardTop - visibleTop;
        }
        if (Math.abs(delta) < 2) {
          return;
        }
        scrollRef.current?.scrollTo({
          y: Math.max(0, contentOffsetY.current + delta),
          animated: true,
        });
      });
    };

    if (footerRef.current) {
      footerRef.current.measureInWindow((_fx, fy) => {
        applyScroll(fy - VISIBLE_MARGIN);
      });
      return;
    }

    const windowHeight = Dimensions.get('window').height;
    applyScroll(windowHeight - keyboardHeightRef.current - VISIBLE_MARGIN);
  }, [headerOffset]);

  const ensureVisible = useCallback((target: RefObject<View | null> | View | null) => {
    const node = resolveTarget(target);
    pendingTarget.current = node;
    requestAnimationFrame(() => scrollTarget(node));
    setTimeout(() => scrollTarget(pendingTarget.current), 280);
  }, [scrollTarget]);

  const measureRoot = useCallback(() => {
    rootRef.current?.measureInWindow((_x, y, _w, h) => {
      setRootBottom(y + h);
    });
  }, []);

  useEffect(() => {
    keyboardHeightRef.current = keyboardHeight;
    if (keyboardTop !== null) {
      requestAnimationFrame(() => scrollTarget(pendingTarget.current));
    }
  }, [keyboardHeight, keyboardTop, scrollTarget]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const timers: ReturnType<typeof setTimeout>[] = [];

    const showSub = Keyboard.addListener(showEvent, (event) => {
      setKeyboardTop(event.endCoordinates.screenY);
      measureRoot();
      timers.push(setTimeout(measureRoot, 120), setTimeout(measureRoot, 350));
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardTop(null);
      pendingTarget.current = null;
      timers.push(setTimeout(measureRoot, 120));
    });

    return () => {
      showSub.remove();
      hideSub.remove();
      timers.forEach(clearTimeout);
    };
  }, [measureRoot]);

  const onFooterLayout = useCallback((event: LayoutChangeEvent) => {
    setFooterContentHeight(event.nativeEvent.layout.height);
  }, []);

  const scrollValue = useMemo(() => ({ ensureVisible }), [ensureVisible]);
  const scrollBottomPadding = footer
    ? footerContentHeight + CONTENT_BOTTOM_PADDING
    : CONTENT_BOTTOM_PADDING;

  return (
    <ScreenScrollContext.Provider value={scrollValue}>
      <View
        ref={rootRef}
        collapsable={false}
        onLayout={measureRoot}
        style={[styles.safe, { backgroundColor: surface }]}
      >
        {gradient ? (
          <LinearGradient
            colors={[gradient[0], gradient[1]]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        ) : null}
        <SafeAreaView style={styles.flex} edges={footer ? ['left', 'right'] : ['bottom', 'left', 'right']}>
          {loading ? (
            <ActivityIndicator color={theme.accent} style={styles.loader} />
          ) : (
            <View style={styles.flex}>
              <ScrollView
                ref={scrollRef}
                collapsable={false}
                onScroll={(event) => {
                  contentOffsetY.current = event.nativeEvent.contentOffset.y;
                }}
                scrollEventThrottle={16}
                contentContainerStyle={[
                  styles.content,
                  { paddingBottom: scrollBottomPadding },
                  centered && styles.centered,
                ]}
                keyboardShouldPersistTaps="handled"
              >
                {children}
              </ScrollView>
              {footer ? (
                <View
                  ref={footerRef}
                  collapsable={false}
                  onLayout={onFooterLayout}
                  style={[
                    styles.footer,
                    {
                      backgroundColor: surface,
                      bottom: 0,
                      paddingBottom: footerBottom,
                    },
                  ]}
                >
                  {footer}
                </View>
              ) : null}
            </View>
          )}
        </SafeAreaView>
      </View>
    </ScreenScrollContext.Provider>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  centered: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  loader: {
    marginTop: 32,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
});
