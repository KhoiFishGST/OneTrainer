import { render, screen, fireEvent } from '@testing-library/svelte';
import { expect, test, vi } from 'vitest';
import AddItemCard from '$lib/components/collections/AddItemCard.svelte';

test('renders AddItemCard with label and handles click', async () => {
  const onClick = vi.fn();
  render(AddItemCard, { label: 'Add Custom Item', onClick });

  const button = screen.getByRole('button', { name: /add custom item/i });
  expect(button).toBeInTheDocument();

  await fireEvent.click(button);
  expect(onClick).toHaveBeenCalledTimes(1);
});
