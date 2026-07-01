import { http, HttpResponse } from 'msw';

const API_URL = 'http://localhost:3001';

export const product = {
  id: 1,
  name: 'Classic White T-Shirt',
  description: 'A wardrobe essential. 100% organic cotton.',
  primary_image: 'https://placehold.co/800x800/f5f5f5/333.png?text=White+T-Shirt',
  image_urls: [
    'https://placehold.co/800x800/f5f5f5/333.png?text=White+T-Shirt',
    'https://placehold.co/800x800/f5f5f5/333.png?text=White+T-Shirt+Back'
  ],
  unit_price: 18.99,
  currency: 'GBP'
};

export const productListing = {
  id: product.id,
  name: product.name,
  primary_image: product.primary_image,
  unit_price: product.unit_price,
  currency: product.currency
};

export const handlers = [
  http.get(`${API_URL}/products`, () => {
    return HttpResponse.json({ results: [productListing] });
  }),
  http.get(`${API_URL}/products/:id`, ({ params }) => {
    if (Number(params.id) !== product.id) {
      return HttpResponse.json({ error: 'Product not found' }, { status: 404 });
    }
    return HttpResponse.json(product);
  })
];
