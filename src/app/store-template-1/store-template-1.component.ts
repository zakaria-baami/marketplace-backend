// src/app/store-template-1/store-template-1.component.ts
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

// Angular Material Imports
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatToolbarModule } from '@angular/material/toolbar';

interface Product {
  id: number;
  name: string;
  price: number;
  image: string;
  description: string;
}

interface Category {
  id: number;
  name: string;
  icon: string;
}

@Component({
  selector: 'app-store-template-1',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatToolbarModule
  ],
  templateUrl: './store-template-1.component.html',
  styleUrls: ['./store-template-1.component.css']
})
export class StoreTemplate1Component {

  // Store Information (Demo Data)
  storeInfo = {
    name: 'My Awesome Store',
    description: 'Welcome to our amazing store where you can find the best products at great prices!',
    logo: 'store',
    phone: '+1 (555) 123-4567',
    email: 'contact@mystore.com',
    address: '123 Main Street, City, State 12345'
  };

  // Categories (Demo Data)
  categories: Category[] = [
    { id: 1, name: 'Electronics', icon: 'devices' },
    { id: 2, name: 'Clothing', icon: 'checkroom' },
    { id: 3, name: 'Home & Garden', icon: 'home' },
    { id: 4, name: 'Sports', icon: 'sports_soccer' }
  ];

  // Featured Products (Demo Data)
  featuredProducts: Product[] = [
    {
      id: 1,
      name: 'Premium Headphones',
      price: 99.99,
      image: 'assets/images/headphones.jpg',
      description: 'High-quality wireless headphones with noise cancellation'
    },
    {
      id: 2,
      name: 'Smart Watch',
      price: 199.99,
      image: 'assets/images/smartwatch.jpg',
      description: 'Latest smartwatch with health tracking features'
    },
    {
      id: 3,
      name: 'Coffee Maker',
      price: 79.99,
      image: 'assets/images/coffee.jpg',
      description: 'Automatic drip coffee maker for perfect coffee every time'
    },
    {
      id: 4,
      name: 'Running Shoes',
      price: 129.99,
      image: 'assets/images/shoes.jpg',
      description: 'Comfortable running shoes for all your fitness needs'
    },
    {
      id: 5,
      name: 'Wireless Speaker',
      price: 49.99,
      image: 'assets/images/speaker.jpg',
      description: 'Portable Bluetooth speaker with amazing sound quality'
    },
    {
      id: 6,
      name: 'Plant Pot Set',
      price: 24.99,
      image: 'assets/images/plants.jpg',
      description: 'Beautiful ceramic pots perfect for indoor plants'
    }
  ];

  constructor() { }

  // Product actions
  onProductClick(product: Product) {
    console.log('Product clicked:', product.name);
    // In real implementation, would navigate to product detail
  }

  onAddToCart(product: Product) {
    console.log('Added to cart:', product.name);
    // In real implementation, would add to cart
  }

  // Category actions
  onCategoryClick(category: Category) {
    console.log('Category clicked:', category.name);
    // In real implementation, would filter products by category
  }

  // Contact actions
  onContactPhone() {
    window.open(`tel:${this.storeInfo.phone}`);
  }

  onContactEmail() {
    window.open(`mailto:${this.storeInfo.email}`);
  }

  // Navigation
  goBackToTemplates() {
    // Navigate back to template selection
    console.log('Going back to template selection');
  }
}