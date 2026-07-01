import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from './setup';
import { productListing } from './msw-handlers';
import ProductListingPage from '@/app/page';

describe('ProductListingPage', () => {
  it('renders a product listing for every product returned by the API', async () => {
    render(await ProductListingPage());

    const list = screen.getByRole('list', { name: 'Product listing' });
    const item = within(list).getByRole('img', { name: productListing.name });
    expect(item).toBeInTheDocument();
    expect(
      within(list).getByText(productListing.name)
    ).toBeInTheDocument();
    expect(
      within(list).getByLabelText(
        `Price: ${productListing.currency} ${productListing.unit_price.toFixed(2)}`
      )
    ).toBeInTheDocument();
  });

  it('shows an empty state when there are no products', async () => {
    server.use(
      http.get('http://localhost:3001/products', () =>
        HttpResponse.json({ results: [] })
      )
    );

    render(await ProductListingPage());

    expect(screen.getByText('No products available.')).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });
});
