import { useState } from 'react';
import { createQuote } from '../../../services/quoteApi';
import './QuoteReview.css';

function QuoteReview({ formData, prevStep, goToStep }) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [quoteResult, setQuoteResult] = useState(null);

  const calculateQuote = () => {
    let baseRate = 100;

    if (formData.insuranceType === 'AUTO') {
      const currentYear = new Date().getFullYear();
      const vehicleAge = currentYear - parseInt(formData.vehicleYear || currentYear);
      if (vehicleAge < 5) baseRate += 30;
      else if (vehicleAge < 10) baseRate += 15;
    } else if (formData.insuranceType === 'HOME') {
      const propertySize = parseInt(formData.propertySize || 0);
      baseRate += Math.floor(propertySize / 100) * 2;

      const currentYear = new Date().getFullYear();
      const homeAge = currentYear - parseInt(formData.yearBuilt || currentYear);
      if (homeAge > 50) baseRate += 20;
      else if (homeAge > 20) baseRate += 10;
    }

    if (formData.coverageLevel === 'COMPREHENSIVE') {
      baseRate *= 1.5;
    } else if (formData.coverageLevel === 'PREMIUM') {
      baseRate *= 2.2;
    }

    const deductible = parseInt(formData.deductible || 1000);
    if (deductible === 500) baseRate *= 1.2;
    else if (deductible === 2500) baseRate *= 0.9;
    else if (deductible === 5000) baseRate *= 0.8;

    const monthlyPremium = Math.round(baseRate * 100) / 100;
    const annualPremium = Math.round(monthlyPremium * 12 * 100) / 100;

    return { monthlyPremium, annualPremium };
  };

  const { monthlyPremium, annualPremium } = quoteResult || calculateQuote();

  const handleGetQuote = async () => {
    setIsLoading(true);
    setError(null);

    const quoteRequest = {
      customerFirstName: formData.firstName,
      customerLastName: formData.lastName,
      customerEmail: formData.email,
      customerPhone: formData.phone,
      customerStreet: formData.street,
      customerCity: formData.city,
      customerState: formData.state,
      customerZip: formData.zipCode,
      insuranceType: formData.insuranceType,
      vehicleYear: formData.vehicleYear ? parseInt(formData.vehicleYear) : null,
      vehicleMake: formData.vehicleMake || null,
      vehicleModel: formData.vehicleModel || null,
      propertyType: formData.propertyType || null,
      propertySize: formData.propertySize ? parseInt(formData.propertySize) : null,
      yearBuilt: formData.yearBuilt ? parseInt(formData.yearBuilt) : null,
      coverageLevel: formData.coverageLevel,
      deductibleAmount: parseFloat(formData.deductible),
    };

    try {
      const response = await createQuote(quoteRequest);
      setQuoteResult({
        monthlyPremium: response.monthlyPremium,
        annualPremium: response.annualPremium,
      });
    } catch (err) {
      setError(err.message || 'Failed to get quote. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTryAgain = () => {
    setError(null);
    setQuoteResult(null);
  };

  const handlePrint = () => {
    window.print();
  };

  const getCoverageName = () => {
    const coverage = {
      LIABILITY: 'Basic Coverage',
      COMPREHENSIVE: 'Full Protection',
      PREMIUM: 'Complete Peace of Mind',
    };
    return coverage[formData.coverageLevel] || formData.coverageLevel;
  };

  return (
    <div className="wizard-form">
      <h2>Quote Review</h2>

      <div className="quote-summary">
        <div className="summary-section">
          <div className="section-header">
            <h3>Customer Information</h3>
            <button type="button" className="edit-link" onClick={() => goToStep(1)}>
              Edit
            </button>
          </div>
          <div className="summary-content">
            <p>
              <strong>Name:</strong> {formData.firstName} {formData.lastName}
            </p>
            <p>
              <strong>Email:</strong> {formData.email}
            </p>
            <p>
              <strong>Phone:</strong> {formData.phone}
            </p>
            <p>
              <strong>Address:</strong> {formData.street}, {formData.city}, {formData.state}{' '}
              {formData.zipCode}
            </p>
          </div>
        </div>

        <div className="summary-section">
          <div className="section-header">
            <h3>{formData.insuranceType === 'AUTO' ? 'Vehicle' : 'Property'} Details</h3>
            <button type="button" className="edit-link" onClick={() => goToStep(2)}>
              Edit
            </button>
          </div>
          <div className="summary-content">
            <p>
              <strong>Insurance Type:</strong>{' '}
              {formData.insuranceType === 'AUTO' ? 'Auto Insurance' : 'Home Insurance'}
            </p>
            {formData.insuranceType === 'AUTO' && (
              <>
                <p>
                  <strong>Vehicle:</strong> {formData.vehicleYear} {formData.vehicleMake}{' '}
                  {formData.vehicleModel}
                </p>
              </>
            )}
            {formData.insuranceType === 'HOME' && (
              <>
                <p>
                  <strong>Property Type:</strong> {formData.propertyType}
                </p>
                <p>
                  <strong>Property Size:</strong> {formData.propertySize} sq ft
                </p>
                <p>
                  <strong>Year Built:</strong> {formData.yearBuilt}
                </p>
              </>
            )}
          </div>
        </div>

        <div className="summary-section">
          <div className="section-header">
            <h3>Coverage Selection</h3>
            <button type="button" className="edit-link" onClick={() => goToStep(3)}>
              Edit
            </button>
          </div>
          <div className="summary-content">
            <p>
              <strong>Coverage Level:</strong> {getCoverageName()}
            </p>
            <p>
              <strong>Deductible:</strong> ${parseInt(formData.deductible || 0).toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="error-message" role="alert" aria-live="assertive">
          <p>
            <strong>Error:</strong> {error}
          </p>
          <button type="button" className="btn-secondary" onClick={handleTryAgain}>
            Try Again
          </button>
        </div>
      )}

      <div className="quote-result">
        <h3>{quoteResult ? 'Your Quote' : 'Your Estimated Quote'}</h3>
        <div className="premium-display">
          <div className="premium-amount">
            <div className="premium-label">Monthly Premium</div>
            <div className="premium-value">${monthlyPremium.toFixed(2)}</div>
            <div className="premium-sublabel">per month</div>
          </div>
          <div className="premium-divider">or</div>
          <div className="premium-amount">
            <div className="premium-label">Annual Premium</div>
            <div className="premium-value">${annualPremium.toFixed(2)}</div>
            <div className="premium-sublabel">per year (save 10%)</div>
          </div>
        </div>
        <p className="quote-disclaimer">
          {quoteResult
            ? 'This quote is based on the information provided. Final rates may vary based on additional underwriting factors.'
            : 'This is an estimated quote based on the information provided. Click "Get Quote" to get your actual rate.'}
        </p>
      </div>

      <div className="wizard-actions">
        <button type="button" className="btn-secondary" onClick={prevStep} disabled={isLoading}>
          Back
        </button>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button type="button" className="btn-secondary" onClick={handlePrint}>
            Print Quote
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={handleGetQuote}
            disabled={isLoading || quoteResult !== null}
          >
            {isLoading ? 'Loading...' : quoteResult ? 'Quote Received' : 'Get Quote'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default QuoteReview;
