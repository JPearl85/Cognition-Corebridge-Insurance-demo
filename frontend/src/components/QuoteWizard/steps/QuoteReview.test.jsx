import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import QuoteReview from './QuoteReview';
import { createQuote } from '../../../services/quoteApi';

vi.mock('../../../services/quoteApi', () => ({
  createQuote: vi.fn(),
}));

describe('QuoteReview', () => {
  const formData = {
    firstName: 'Jane',
    lastName: 'Doe',
    email: 'jane@example.com',
    phone: '412-555-0100',
    street: '1 Main St',
    city: 'Pittsburgh',
    state: 'PA',
    zipCode: '15222',
    insuranceType: 'AUTO',
    vehicleYear: '2010',
    vehicleMake: 'Toyota',
    vehicleModel: 'Camry',
    coverageLevel: 'LIABILITY',
    deductible: '1000',
  };

  beforeEach(() => {
    vi.mocked(createQuote).mockReset();
  });

  it('sends the ZIP code as customerZip to match the API contract', async () => {
    vi.mocked(createQuote).mockResolvedValue({ monthlyPremium: 95, annualPremium: 1083 });

    render(<QuoteReview formData={formData} prevStep={vi.fn()} goToStep={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Get Quote' }));

    await waitFor(() => expect(createQuote).toHaveBeenCalledTimes(1));
    const request = vi.mocked(createQuote).mock.calls[0][0];
    expect(request.customerZip).toBe('15222');
    expect(request).not.toHaveProperty('customerZipCode');
    expect(await screen.findByRole('button', { name: 'Quote Received' })).toBeInTheDocument();
  });
});
