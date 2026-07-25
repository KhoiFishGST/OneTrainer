import { render, screen, fireEvent } from '@testing-library/svelte';
import { expect, test, vi } from 'vitest';
import AddCard from './AddCard.svelte';

test('renders AddCard with label and handles click', async () => {
  const onClick = vi.fn();
  render(AddCard, { label: 'Add Custom Item', onClick });

  const button = screen.getByRole('button', { name: /add custom item/i });
  expect(button).toBeInTheDocument();

  await fireEvent.click(button);
  expect(onClick).toHaveBeenCalledTimes(1);
});
