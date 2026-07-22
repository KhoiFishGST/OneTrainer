import { render, screen } from '@testing-library/svelte';
import { expect, it } from 'vitest';
import StatusBarTestWrapper from './StatusBarTestWrapper.svelte';

it('renders connection state and disabled action buttons with aria-disabled', () => {
  render(StatusBarTestWrapper, { connected: true });

  expect(screen.getByText('Connected')).toBeVisible();

  const startBtn = screen.getByRole('button', { name: 'Start' });
  expect(startBtn).toHaveAttribute('aria-disabled', 'true');
  expect(startBtn).toBeDisabled();

  const sampleBtn = screen.getByRole('button', { name: 'Sample' });
  expect(sampleBtn).toHaveAttribute('aria-disabled', 'true');

  const backupBtn = screen.getByRole('button', { name: 'Backup' });
  expect(backupBtn).toHaveAttribute('aria-disabled', 'true');

  const saveBtn = screen.getByRole('button', { name: 'Save' });
  expect(saveBtn).toHaveAttribute('aria-disabled', 'true');
});
