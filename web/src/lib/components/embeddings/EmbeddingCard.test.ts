import { fireEvent, render, screen } from '@testing-library/svelte';
import { expect, it, vi } from 'vitest';
import EmbeddingCard from './EmbeddingCard.svelte';

it('updates fields and preserves clone/remove/browse callbacks', async () => {
  const embedding = { model_name: '', placeholder: '<x>', token_count: 1, train: true, initial_embedding_text: '*' };
  const onClone = vi.fn(), onRemove = vi.fn(), onOpenDirectory = vi.fn((_p: string, cb?: (path: string) => void) => cb?.('/model.pt'));
  render(EmbeddingCard, { embedding, index: 0, onClone, onRemove, onOpenDirectory });
  await fireEvent.input(screen.getByLabelText('Placeholder'), { target: { value: '<y>' } });
  await fireEvent.click(screen.getByTitle('Browse file'));
  expect(embedding.placeholder).toBe('<y>');
  expect(embedding.model_name).toBe('/model.pt');
  await fireEvent.click(screen.getByTitle('Clone embedding'));
  await fireEvent.click(screen.getByTitle('Remove embedding'));
  const confirmBtn = screen.getAllByRole('button', { name: /^remove$/i }).pop()!;
  await fireEvent.click(confirmBtn);
  expect(onClone).toHaveBeenCalledWith(0);
  expect(onRemove).toHaveBeenCalledWith(0);
});
