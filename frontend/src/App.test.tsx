import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

test('renders the Engineer Kingdom home page', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: /build your legacy in the engineer kingdom/i })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /enter the kingdom/i })).toHaveAttribute('href', '/paths');
});
