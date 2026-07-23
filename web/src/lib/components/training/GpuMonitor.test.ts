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
});
