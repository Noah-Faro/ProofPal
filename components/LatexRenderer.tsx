import React, { useState } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { COLORS } from '../constants/theme';

export interface LatexRendererProps {
  /** Markdown + LaTeX content string ($ for inline, $$ for display math) */
  content: string;
  /** Optional custom container style */
  style?: ViewStyle;
}

/**
 * HTML template for rendering Markdown with KaTeX math notation.
 * Loads KaTeX and Marked.js from CDN with dark-theme styling matching ProofPal.
 */
const getHtmlTemplate = (content: string): string => {
  const jsonContent = JSON.stringify(content || '').replace(/<\/script/gi, '<\\/script');

  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
  <style>
    * {
      box-sizing: border-box;
    }
    body { 
      background: ${COLORS.bgDark}; 
      color: ${COLORS.textPrimary}; 
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; 
      font-size: 16px; 
      line-height: 1.6; 
      padding: 12px; 
      margin: 0;
      word-wrap: break-word;
    }
    h1, h2, h3 { 
      color: ${COLORS.primaryLight}; 
      margin-top: 16px; 
      margin-bottom: 8px; 
    }
    code { 
      background: ${COLORS.bgSurface}; 
      padding: 2px 6px; 
      border-radius: 4px; 
      color: ${COLORS.accent}; 
      font-family: monospace; 
    }
    pre { 
      background: ${COLORS.bgSurface}; 
      padding: 12px; 
      border-radius: 8px; 
      overflow-x: auto; 
    }
    .katex-display { 
      overflow-x: auto; 
      overflow-y: hidden; 
      padding: 4px 0; 
      margin: 8px 0; 
    }
    strong { color: ${COLORS.textPrimary}; }
    em { color: ${COLORS.textSecondary}; }
    blockquote { 
      border-left: 3px solid ${COLORS.primary}; 
      padding-left: 12px; 
      margin-left: 0; 
      color: ${COLORS.textSecondary}; 
    }
    ul, ol { 
      padding-left: 20px; 
      margin-top: 4px; 
      margin-bottom: 8px; 
    }
    li { margin-bottom: 4px; }
    p { margin-top: 0; margin-bottom: 8px; }
  </style>
</head>
<body>
  <div id="content"></div>
  <script src="https://cdn.jsdelivr.net/npm/marked@12.0.0/marked.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js"></script>
  <script>
    (function() {
      try {
        const content = ${jsonContent};
        document.getElementById('content').innerHTML = marked.parse(content);
        renderMathInElement(document.getElementById('content'), {
          delimiters: [
            {left: '$$', right: '$$', display: true},
            {left: '$', right: '$', display: false},
            {left: '\\\\(', right: '\\\\)', display: false},
            {left: '\\\\[', right: '\\\\]', display: true},
          ],
          throwOnError: false,
        });
      } catch (e) {
        console.error(e);
      }
      
      function sendHeight() {
        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
          var height = document.body.scrollHeight || document.documentElement.scrollHeight;
          window.ReactNativeWebView.postMessage(JSON.stringify({ height: height }));
        }
      }

      setTimeout(sendHeight, 100);
      setTimeout(sendHeight, 500);
      setTimeout(sendHeight, 1000);
    })();
  </script>
</body>
</html>`;
};

/**
 * LatexRenderer renders Markdown + LaTeX text from AI responses using a WebView with KaTeX and Marked.js.
 * Auto-adjusts height based on rendered content size.
 */
export const LatexRenderer: React.FC<LatexRendererProps> = ({ content, style }) => {
  const [webViewHeight, setWebViewHeight] = useState<number>(100);

  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data && typeof data.height === 'number' && data.height > 0) {
        setWebViewHeight(data.height);
      }
    } catch (e) {
      // Ignore parse errors
    }
  };

  const htmlSource = React.useMemo(() => ({ html: getHtmlTemplate(content) }), [content]);

  return (
    <View style={[styles.container, { height: webViewHeight }, style]}>
      <WebView
        originWhitelist={['*']}
        source={htmlSource}
        onMessage={handleMessage}
        scrollEnabled={false}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        style={styles.webView}
        containerStyle={styles.webViewContainer}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  webViewContainer: {
    backgroundColor: 'transparent',
  },
  webView: {
    backgroundColor: 'transparent',
  },
});

export default LatexRenderer;
