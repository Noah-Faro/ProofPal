import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { ErrorDialog } from '../ErrorDialog';

jest.setTimeout(15000); // Prevent timeouts on slow CI environments

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

  it('renders Switch to Flash 3.6 button when suggestFallbackModel is provided', async () => {
    const onSwitchModel = jest.fn();
    const screen = await render(
      <ErrorDialog
        error={{
          code: 'RATE_LIMIT',
          message: "You've reached the free tier limit for this model. Try switching to Flash 3.6, or wait a few minutes.",
          retryable: true,
          recoveryAction: 'retry',
          suggestFallbackModel: 'gemini-3.6-flash',
        }}
        onDismiss={jest.fn()}
        onRetry={jest.fn()}
        onAddApiKey={jest.fn()}
        onOpenSettings={jest.fn()}
        onSwitchModel={onSwitchModel}
      />,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Switch to Flash 3.6' }));
    expect(onSwitchModel).toHaveBeenCalledWith('gemini-3.6-flash');
  });
});
