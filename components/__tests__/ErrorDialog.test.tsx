import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { ErrorDialog } from '../ErrorDialog';

describe('ErrorDialog', () => {
  it('uses the provided recovery action and keeps dismiss available', async () => {
    const onDismiss = jest.fn();
    const onRetry = jest.fn();
    const screen = await render(
      <ErrorDialog
        error={{ code: 'TIMEOUT', message: 'The request timed out.', retryable: true, recoveryAction: 'retry' }}
        onDismiss={onDismiss}
        onRetry={onRetry}
        onAddApiKey={jest.fn()}
        onOpenSettings={jest.fn()}
      />,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Retry' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Dismiss error dialog' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
