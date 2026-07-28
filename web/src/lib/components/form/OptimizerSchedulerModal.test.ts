import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import OptimizerSchedulerModal from './OptimizerSchedulerModal.svelte';
import type { SchemaField } from '../../config/validation';

describe('OptimizerSchedulerModal', () => {
  const sampleFields: SchemaField[] = [
    {
      id: 'learning_rate',
      keys: ['learning_rate'],
      label: 'Learning Rate',
      control: 'number',
    },
    {
      id: 'beta1',
      keys: ['beta1'],
      label: 'Beta 1',
      control: 'number',
    },
    {
      id: 'use_decouple',
      keys: ['use_decouple'],
      label: 'Use Decoupled Weight Decay',
      control: 'toggle',
    },
    {
      id: 'optimizer_type',
      keys: ['optimizer_type'],
      label: 'Optimizer Type',
      control: 'select',
      options: [
        { value: 'adamw', label: 'AdamW' },
        { value: 'prodigy', label: 'Prodigy' },
      ],
    },
  ];

  const initialValues = {
    learning_rate: 0.0001,
    beta1: 0.9,
    use_decouple: true,
    optimizer_type: 'adamw',
  };

  it('renders modal with title and fields when open is true', () => {
    render(OptimizerSchedulerModal, {
      props: {
        open: true,
        title: 'AdamW Parameters',
        fields: sampleFields,
        values: initialValues,
        onSave: vi.fn(),
      },
    });

    expect(screen.getByText('AdamW Parameters')).toBeInTheDocument();
    expect(screen.getByLabelText('Learning Rate')).toHaveValue(0.0001);
    expect(screen.getByLabelText('Beta 1')).toHaveValue(0.9);
    expect(screen.getByLabelText('Use Decoupled Weight Decay')).toBeChecked();
    expect(screen.getByLabelText('Optimizer Type')).toHaveValue('adamw');
  });

  it('calls onSave with updated values when Save button is clicked', async () => {
    const onSave = vi.fn();
    render(OptimizerSchedulerModal, {
      props: {
        open: true,
        title: 'AdamW Parameters',
        fields: sampleFields,
        values: initialValues,
        onSave,
      },
    });

    const lrInput = screen.getByLabelText('Learning Rate');
    await fireEvent.input(lrInput, { target: { value: '0.0005' } });

    const saveBtn = screen.getByRole('button', { name: /save/i });
    await fireEvent.click(saveBtn);

    expect(onSave).toHaveBeenCalledWith({
      learning_rate: 0.0005,
      beta1: 0.9,
      use_decouple: true,
      optimizer_type: 'adamw',
    });
  });

  it('calls onClose without onSave when Cancel button is clicked', async () => {
    const onSave = vi.fn();
    const onClose = vi.fn();
    render(OptimizerSchedulerModal, {
      props: {
        open: true,
        title: 'AdamW Parameters',
        fields: sampleFields,
        values: initialValues,
        onSave,
        onClose,
      },
    });

    const cancelBtn = screen.getByRole('button', { name: /cancel/i });
    await fireEvent.click(cancelBtn);

    expect(onClose).toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("does not reset draft when values prop changes while open stays true", async () => {
    const { rerender } = render(OptimizerSchedulerModal, {
      props: {
        open: true,
        title: 'AdamW Parameters',
        fields: sampleFields,
        values: initialValues,
        onSave: vi.fn(),
      },
    });

    const lrInput = screen.getByLabelText('Learning Rate');
    await fireEvent.input(lrInput, { target: { value: '0.005' } });
    expect(lrInput).toHaveValue(0.005);

    await rerender({
      open: true,
      title: 'AdamW Parameters',
      fields: sampleFields,
      values: { ...initialValues, learning_rate: 0.999 },
      onSave: vi.fn(),
    });

    expect(lrInput).toHaveValue(0.005);
  });

  it("retains open state and draft when async apply fails", async () => {
    const onSave = vi.fn().mockRejectedValue(new Error("Save failed"));

    render(OptimizerSchedulerModal, {
      props: {
        open: true,
        title: 'AdamW Parameters',
        fields: sampleFields,
        values: initialValues,
        onSave,
      },
    });

    const lrInput = screen.getByLabelText('Learning Rate');
    await fireEvent.input(lrInput, { target: { value: '0.005' } });

    const saveBtn = screen.getByRole('button', { name: /save/i });
    await fireEvent.click(saveBtn);

    expect(onSave).toHaveBeenCalled();
    expect(screen.getByText('AdamW Parameters')).toBeInTheDocument();
    expect(lrInput).toHaveValue(0.005);
  });

  it("disables submit button and shows pending state during async save operation", async () => {
    let resolveSave: (val?: any) => void = () => {};
    const pendingSave = new Promise((resolve) => {
      resolveSave = resolve;
    });
    const onSave = vi.fn().mockReturnValue(pendingSave);

    render(OptimizerSchedulerModal, {
      props: {
        open: true,
        title: 'AdamW Parameters',
        fields: sampleFields,
        values: initialValues,
        onSave,
      },
    });

    const saveBtn = screen.getByRole('button', { name: /save/i });
    await fireEvent.click(saveBtn);

    expect(saveBtn).toBeDisabled();
    expect(screen.getByText("Save...")).toBeInTheDocument();

    resolveSave();
    await pendingSave;
  });
});

