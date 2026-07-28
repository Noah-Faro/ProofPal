# Implementation Tasks

## Task 1: Bottom Sheet & Chat Improvements (app/index.tsx)
- [x] 1. Bottom Sheet: Removed `<Modal visible={showFeedback}...>` wrapper around bottom sheet and replaced with `<Animated.View style={[StyleSheet.absoluteFill, { zIndex: 100 }]} pointerEvents={showFeedback ? 'auto' : 'none'}>`.
- [x] 2. KeyboardAvoidingView: Wrapped chat input & body effectively without Modal restrictions.
- [x] 3. PanResponder: Detached `panHandlers` from `sheetContainer` and attached `{...panResponder.panHandlers}` only to `sheetHeader` and `sheetHandle`.
- [x] 4. "Paste Image" Button: Added "📋" button next to camera icon in `chatInputRow` calling `expo-clipboard.getImageAsync({ format: 'png' })`.
- [x] 5. Drag and Drop Image: Wrapped chat container with `expo-drag-drop-content-view` (`NativeDragDropView`).
