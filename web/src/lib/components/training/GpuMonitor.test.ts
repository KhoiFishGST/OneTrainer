import { render, screen } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import GpuMonitor from './GpuMonitor.svelte';

describe('GpuMonitor', () => {
  it('renders offline / no telemetry state when gpuStats is null', () => {
    render(GpuMonitor, { props: { gpuStats: null } });
    expect(screen.getByText(/No GPU telemetry available/i)).toBeInTheDocument();
    expect(screen.getByText(/OFFLINE/i)).toBeInTheDocument();
  });

  it('renders VRAM, GPU utilization, and temperature meters when gpuStats provided', () => {
    const mockGpuStats = {
      vram_used_mb: 8192,
      vram_total_mb: 16384,
      gpu_util_pct: 95,
      temp_c: 68,
    };

    render(GpuMonitor, { props: { gpuStats: mockGpuStats } });

    expect(screen.getByText(/LIVE/i)).toBeInTheDocument();
    expect(screen.getByText(/8\.0 GB \/ 16\.0 GB/i)).toBeInTheDocument();
    expect(screen.getByText(/50% Allocated/i)).toBeInTheDocument();
    expect(screen.getByText(/95%/i)).toBeInTheDocument();
    expect(screen.getByText(/68 °C/i)).toBeInTheDocument();
  });

  it('handles bytes-based vram_used and vram_total', () => {
    const mockGpuStats = {
      vram_used: 12 * 1024 * 1024 * 1024,
      vram_total: 24 * 1024 * 1024 * 1024,
      utilization: 0.85,
      temperature: 72,
    };

    render(GpuMonitor, { props: { gpuStats: mockGpuStats } });

    expect(screen.getByText(/12\.0 GB \/ 24\.0 GB/i)).toBeInTheDocument();
    expect(screen.getByText(/85%/i)).toBeInTheDocument();
    expect(screen.getByText(/72 °C/i)).toBeInTheDocument();
  });

  it('names the device under the panel heading', () => {
    render(GpuMonitor, {
      props: {
        gpuStats: {
          name: 'NVIDIA GeForce RTX 5090',
          devices: [
            {
              index: 0,
              name: 'NVIDIA GeForce RTX 5090',
              vram_used: 8 * 1024 * 1024 * 1024,
              vram_total: 32 * 1024 * 1024 * 1024,
              utilization: 40,
              temperature: 55,
            },
          ],
        },
      },
    });

    expect(screen.getByText('NVIDIA GeForce RTX 5090')).toBeInTheDocument();
    expect(screen.getByText(/8\.0 GB \/ 32\.0 GB/i)).toBeInTheDocument();
  });

  it('renders a labelled section per device on a multi-GPU machine', () => {
    render(GpuMonitor, {
      props: {
        gpuStats: {
          devices: [
            {
              index: 0,
              name: 'NVIDIA GeForce RTX 5090',
              vram_used: 4 * 1024 * 1024 * 1024,
              vram_total: 32 * 1024 * 1024 * 1024,
              utilization: 40,
              temperature: 55,
            },
            {
              index: 1,
              name: 'NVIDIA GeForce RTX 4090',
              vram_used: 12 * 1024 * 1024 * 1024,
              vram_total: 24 * 1024 * 1024 * 1024,
              utilization: 90,
              temperature: 71,
            },
          ],
        },
      },
    });

    // Indexed once there is more than one, so two cards of the same model
    // stay tellable apart.
    expect(screen.getByText('GPU 0 · NVIDIA GeForce RTX 5090')).toBeInTheDocument();
    expect(screen.getByText('GPU 1 · NVIDIA GeForce RTX 4090')).toBeInTheDocument();

    // Each device reports its own numbers, not the first device's repeated.
    expect(screen.getByText(/4\.0 GB \/ 32\.0 GB/i)).toBeInTheDocument();
    expect(screen.getByText(/12\.0 GB \/ 24\.0 GB/i)).toBeInTheDocument();
    expect(screen.getByText(/71 °C/i)).toBeInTheDocument();

    expect(screen.getAllByText('VRAM Usage')).toHaveLength(2);
  });

  it('distinguishes two identical cards by index', () => {
    render(GpuMonitor, {
      props: {
        gpuStats: {
          devices: [
            { index: 0, name: 'NVIDIA GeForce RTX 5090', vram_used: 1, vram_total: 2, utilization: 1, temperature: 1 },
            { index: 1, name: 'NVIDIA GeForce RTX 5090', vram_used: 1, vram_total: 2, utilization: 1, temperature: 1 },
          ],
        },
      },
    });

    expect(screen.getByText('GPU 0 \u00b7 NVIDIA GeForce RTX 5090')).toBeInTheDocument();
    expect(screen.getByText('GPU 1 \u00b7 NVIDIA GeForce RTX 5090')).toBeInTheDocument();
  });

  it('still renders the legacy flat payload with no device list', () => {
    render(GpuMonitor, {
      props: {
        gpuStats: { vram_used_mb: 8192, vram_total_mb: 16384, gpu_util_pct: 95, temp_c: 68 },
      },
    });

    expect(screen.getByText(/8\.0 GB \/ 16\.0 GB/i)).toBeInTheDocument();
    expect(screen.queryByText(/^GPU \d/)).toBeNull();
  });
});
