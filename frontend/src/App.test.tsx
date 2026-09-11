import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

test('renders the Engineer Made home page', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: /build your legacy in the engineer made/i })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /explore learning paths/i })).toHaveAttribute('href', '/paths');
});
