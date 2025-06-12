// src/app/product-detail/product-detail.component.ts
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

// Angular Material Imports
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatCardModule } from '@angular/material/card';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatCheckboxModule } from '@angular/material/checkbox';

interface Category {
  id: number;
  name: string;
  count: number;
}

interface ProductOption {
  label: string;
  values: string[];
}

interface Product {
  id: number;
  name: string;
  price: number;
  images: string[];
  description: string;
  storeName: string;
  options: ProductOption[];
}

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatSelectModule,
    MatCardModule,
    MatSidenavModule,
    MatListModule,
    MatCheckboxModule
  ],
  templateUrl: './product-detail.component.html',
  styleUrls: ['./product-detail.component.css']
})
export class ProductDetailComponent {
  
  selectedLanguage = 'EN';
  currentImageIndex = 0;
  selectedOptions: {[key: string]: string} = {};

  // Mock categories for sidebar
  categories: Category[] = [
    { id: 1, name: 'Electronics', count: 25 },
    { id: 2, name: 'Fashion', count: 18 },
    { id: 3, name: 'Home & Garden', count: 12 },
    { id: 4, name: 'Sports', count: 8 },
    { id: 5, name: 'Books', count: 15 }
  ];

  // Mock product data
  product: Product = {
    id: 1,
    name: 'Nom de l\'article',
    price: 99.99,
    images: [
      'assets/images/product-1.jpg',
      'assets/images/product-2.jpg',
      'assets/images/product-3.jpg',
      'assets/images/product-4.jpg',
      'assets/images/product-5.jpg'
    ],
    description: 'details details details details details details details details details details details details details details details',
    storeName: 'store name',
    options: [
      {
        label: 'Size',
        values: ['Small', 'Medium', 'Large', 'X-Large']
      },
      {
        label: 'Color',
        values: ['Red', 'Blue', 'Green', 'Black', 'White']
      }
    ]
  };

  constructor() {
    // Initialize selected options
    this.product.options.forEach(option => {
      this.selectedOptions[option.label] = option.values[0];
    });
  }

  // Header methods
  onCartClick() {
    console.log('Cart clicked');
  }

  onSignUpClick() {
    console.log('Sign up clicked');
  }

  onLanguageChange(language: string) {
    this.selectedLanguage = language;
    console.log('Language changed to:', language);
  }

  // Category filter methods
  onCategorySelect(category: Category) {
    console.log('Category selected:', category.name);
  }

  // Product image methods
  selectImage(index: number) {
    this.currentImageIndex = index;
  }

  previousImage() {
    this.currentImageIndex = this.currentImageIndex > 0 
      ? this.currentImageIndex - 1 
      : this.product.images.length - 1;
  }

  nextImage() {
    this.currentImageIndex = this.currentImageIndex < this.product.images.length - 1 
      ? this.currentImageIndex + 1 
      : 0;
  }

  // Product interaction methods
  onOptionChange(optionLabel: string, value: string) {
    this.selectedOptions[optionLabel] = value;
    console.log('Option changed:', optionLabel, value);
  }

  addToCart() {
    console.log('Adding to cart:', {
      product: this.product,
      options: this.selectedOptions
    });
    // Add to cart logic here
  }
}