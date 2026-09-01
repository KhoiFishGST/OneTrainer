import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import PathInput from './PathInput.svelte';

describe('PathInput', () => {
  it('renders input value and browse button', () => {
    render(PathInput, { props: { value: '/tmp/model.safetensors', label: 'Model Path' } });
    expect(screen.getByLabelText('Model Path')).toHaveValue('/tmp/model.safetensors');
    expect(screen.getByRole('button', { name: /browse/i })).toBeInTheDocument();
  });

  it('displays extension mask tags when extensions prop is provided', () => {
    render(PathInput, {
      props: {
        value: '/tmp/model.safetensors',
        label: 'Model Path',
        extensions: ['.safetensors', '.ckpt'],
      },
    });
    expect(screen.getByText('.safetensors')).toBeInTheDocument();
    expect(screen.getByText('.ckpt')).toBeInTheDocument();
  });

  it('triggers onInput callback when typing in input field', async () => {
    const onInput = vi.fn();
    render(PathInput, {
      props: {
        value: '/tmp/model.safetensors',
        label: 'Model Path',
        onInput,
      },
    });

    const input = screen.getByLabelText('Model Path');
    await fireEvent.input(input, { target: { value: '/tmp/new_model.safetensors' } });
    expect(onInput).toHaveBeenCalledWith('/tmp/new_model.safetensors');
  });

  it('opens picker dialog when browse button is clicked', async () => {
    render(PathInput, {
      props: {
        value: '/tmp',
        label: 'Model Path',
        mode: 'file',
        extensions: ['.safetensors'],
      },
    });

    const browseBtn = screen.getByRole('button', { name: /browse/i });
    await fireEvent.click(browseBtn);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('handles trailing slashes in file preview name', () => {
    render(PathInput, {
      props: {
        value: '/tmp/model.safetensors/',
        label: 'Model Path',
        mode: 'file',
      },
    });
    expect(screen.getByText('model.safetensors')).toBeInTheDocument();
  });
});
