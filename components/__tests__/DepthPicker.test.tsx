import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { DepthPicker } from '../DepthPicker';
import { PedagogicalDepth } from '../../models/types';

describe('DepthPicker', () => {
  it('renders all five help levels without a scroll container and updates the selection', async () => {
    const onDepthChange = jest.fn();
    const screen = await render(<DepthPicker selectedDepth={PedagogicalDepth.GUIDE} onDepthChange={onDepthChange} />);

    expect(screen.getAllByRole('radio')).toHaveLength(5);
    expect(screen.getByRole('radio', { name: 'Guide help level' }).props.accessibilityState).toMatchObject({ selected: true });
    await fireEvent.press(screen.getByRole('radio', { name: 'Solve help level' }));
    expect(onDepthChange).toHaveBeenCalledWith(PedagogicalDepth.SOLVE);
  });
});
