import { render, screen, fireEvent } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import SampleGallery from './SampleGallery.svelte';

describe('SampleGallery', () => {
  const mockSamples = [
    {
      id: 'sample-1',
      step: 100,
      epoch: 1,
      prompt: 'a photo of a majestic cat sitting on grass',
      seed: 42,
      url: '/api/training/samples/sample_100.png',
    },
    {
      id: 'sample-2',
      step: 200,
      epoch: 2,
      prompt: 'a photo of a majestic cat wearing sunglasses',
      seed: 1234,
      url: '/api/training/samples/sample_200.png',
    },
    {
      id: 'sample-3',
      step: 300,
      epoch: 3,
      prompt: 'a futuristic city skyline at sunset',
      seed: 9999,
      url: '/api/training/samples/sample_300.png',
    },
  ];

  it('renders empty gallery placeholder when no samples exist', () => {
    render(SampleGallery, { props: { samples: [] } });
    expect(screen.getByText(/no samples generated yet/i)).toBeInTheDocument();
  });

  it('renders list of sample cards when samples are provided', () => {
    render(SampleGallery, { props: { samples: mockSamples } });
    expect(screen.getByText(/a photo of a majestic cat sitting on grass/i)).toBeInTheDocument();
    expect(screen.getByText(/a photo of a majestic cat wearing sunglasses/i)).toBeInTheDocument();
    expect(screen.getByText(/a futuristic city skyline at sunset/i)).toBeInTheDocument();
    expect(screen.getByText(/Step 100/i)).toBeInTheDocument();
    expect(screen.getByText(/Step 200/i)).toBeInTheDocument();
    expect(screen.getByText(/Step 300/i)).toBeInTheDocument();
  });

  it('filters samples based on timeline scrubber value', async () => {
    render(SampleGallery, { props: { samples: mockSamples } });

    const scrubber = screen.getByRole('slider', { name: /timeline|step scrubber|step/i }) as HTMLInputElement;
    expect(scrubber).toBeInTheDocument();

    // Move scrubber to max step 200 (filtering out step 300)
    await fireEvent.input(scrubber, { target: { value: '200' } });

    expect(screen.getByText(/a photo of a majestic cat sitting on grass/i)).toBeInTheDocument();
    expect(screen.getByText(/a photo of a majestic cat wearing sunglasses/i)).toBeInTheDocument();
    expect(screen.queryByText(/a futuristic city skyline at sunset/i)).not.toBeInTheDocument();
  });

  it('opens and closes lightbox overlay modal when sample is clicked', async () => {
    render(SampleGallery, { props: { samples: mockSamples } });

    // Click on the first sample card or image
    const sampleCard = screen.getByText(/a photo of a majestic cat sitting on grass/i);
    await fireEvent.click(sampleCard);

    // Lightbox modal should open displaying full image details
    const lightboxModal = screen.getByTestId('sample-lightbox-modal');
    expect(lightboxModal).toBeInTheDocument();
    expect(screen.getByText(/Seed: 42/i)).toBeInTheDocument();

    // Click close button
    const closeBtn = screen.getByRole('button', { name: /close/i });
    await fireEvent.click(closeBtn);

    expect(screen.queryByTestId('sample-lightbox-modal')).not.toBeInTheDocument();
  });
});
