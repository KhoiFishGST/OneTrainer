import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import SampleDetailModal from './SampleDetailModal.svelte';

describe('SampleDetailModal Component', () => {
  const sampleConfig = {
    prompt: 'a beautiful cat in a garden',
    negative_prompt: 'blurry, ugly',
    width: 512,
    height: 512,
    diffusion_steps: 30,
    cfg_scale: 7.5,
    seed: -1,
    noise_scheduler: 'EULER_A',
    enabled: true,
  };

  it('renders modal title "Add Sample Prompt" when mode is "add"', () => {
    render(SampleDetailModal, {
      props: {
        open: true,
        sample: null,
        mode: 'add',
        onSave: vi.fn(),
        onClose: vi.fn(),
      },
    });

    expect(screen.getByRole('heading', { name: /add sample prompt/i })).toBeInTheDocument();
  });

  it('renders modal title "Edit Sample Prompt" when mode is "edit"', () => {
    render(SampleDetailModal, {
      props: {
        open: true,
        sample: sampleConfig,
        mode: 'edit',
        onSave: vi.fn(),
        onClose: vi.fn(),
      },
    });

    expect(screen.getByRole('heading', { name: /edit sample prompt/i })).toBeInTheDocument();
  });

  it('populates inputs with sample data and handles field changes', async () => {
    render(SampleDetailModal, {
      props: {
        open: true,
        sample: sampleConfig,
        mode: 'edit',
        onSave: vi.fn(),
        onClose: vi.fn(),
      },
    });

    const promptInput = screen.getByLabelText(/^prompt$/i);
    const negPromptInput = screen.getByLabelText(/^negative prompt$/i);
    const widthInput = screen.getByLabelText(/width/i);
    const heightInput = screen.getByLabelText(/height/i);
    const stepsInput = screen.getByLabelText(/steps/i);
    const cfgInput = screen.getByLabelText(/cfg scale/i);
    const seedInput = screen.getByLabelText(/seed/i);
    const schedulerSelect = screen.getByLabelText(/scheduler/i);
    const enabledToggle = screen.getByLabelText(/enabled/i);

    expect(promptInput).toHaveValue('a beautiful cat in a garden');
    expect(negPromptInput).toHaveValue('blurry, ugly');
    expect(widthInput).toHaveValue('512');
    expect(heightInput).toHaveValue('512');
    expect(stepsInput).toHaveValue('30');
    expect(cfgInput).toHaveValue('7.5');
    expect(seedInput).toHaveValue('-1');
    expect(schedulerSelect).toHaveValue('EULER_A');
    expect(enabledToggle).toBeChecked();
  });

  it('updates width and height when resolution preset buttons (512, 768, 1024) are clicked', async () => {
    render(SampleDetailModal, {
      props: {
        open: true,
        sample: sampleConfig,
        mode: 'edit',
        onSave: vi.fn(),
        onClose: vi.fn(),
      },
    });

    const preset768Btn = screen.getByRole('button', { name: '768' });
    await fireEvent.click(preset768Btn);

    const widthInput = screen.getByLabelText(/width/i);
    const heightInput = screen.getByLabelText(/height/i);

    expect(widthInput).toHaveValue('768');
    expect(heightInput).toHaveValue('768');

    const preset1024Btn = screen.getByRole('button', { name: '1024' });
    await fireEvent.click(preset1024Btn);

    expect(widthInput).toHaveValue('1024');
    expect(heightInput).toHaveValue('1024');
  });

  it('emits onSave with updated sample object when save button is clicked', async () => {
    const onSave = vi.fn();
    render(SampleDetailModal, {
      props: {
        open: true,
        sample: sampleConfig,
        mode: 'edit',
        onSave,
        onClose: vi.fn(),
      },
    });

    const promptInput = screen.getByLabelText(/^prompt$/i);
    await fireEvent.input(promptInput, { target: { value: 'a hyperrealistic dog in space' } });

    const widthInput = screen.getByLabelText(/width/i);
    const stepsInput = screen.getByLabelText(/steps/i);
    const cfgInput = screen.getByLabelText(/cfg scale/i);
    const seedInput = screen.getByLabelText(/seed/i);

    await fireEvent.input(widthInput, { target: { value: '768' } });
    await fireEvent.input(stepsInput, { target: { value: '40' } });
    await fireEvent.input(cfgInput, { target: { value: '8.5' } });
    await fireEvent.input(seedInput, { target: { value: '123' } });

    const applyBtn = screen.getByRole('button', { name: /save/i });
    await fireEvent.click(applyBtn);

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: 'a hyperrealistic dog in space',
        negative_prompt: 'blurry, ugly',
        width: 768,
        height: 512,
        diffusion_steps: 40,
        cfg_scale: 8.5,
        seed: 123,
        noise_scheduler: 'EULER_A',
        enabled: true,
      })
    );
  });

  it('preserves webui_id when editing sample', async () => {
    const onSave = vi.fn();
    const sampleWithId = { ...sampleConfig, webui_id: 'prompt_a' };
    render(SampleDetailModal, {
      props: {
        open: true,
        sample: sampleWithId,
        mode: 'edit',
        onSave,
        onClose: vi.fn(),
      },
    });

    const applyBtn = screen.getByRole('button', { name: /save/i });
    await fireEvent.click(applyBtn);

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        webui_id: 'prompt_a',
      })
    );
  });
});
