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

interface Category {
  id: number;
  name: string;
  icon: string;
}

interface Product {
  id: number;
  name: string;
  price: number;
  image: string;
  category: string;
}

@Component({
  selector: 'app-home',
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
    MatCardModule
  ],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent {
  
  categories: Category[] = [
    { id: 1, name: 'Electronics', icon: 'devices' },
    { id: 2, name: 'Fashion', icon: 'checkroom' },
    { id: 3, name: 'Home & Garden', icon: 'home' },
    { id: 4, name: 'Sports', icon: 'sports_soccer' },
    { id: 5, name: 'Books', icon: 'menu_book' },
    { id: 6, name: 'Beauty', icon: 'face' },
    { id: 7, name: 'Automotive', icon: 'directions_car' },
    { id: 8, name: 'Toys', icon: 'toys' }
  ];

  products: Product[] = [
    { id: 1, name: 'Smartphone', price: 299.99, image: 'assets/images/product1.jpg', category: 'Electronics' },
    { id: 2, name: 'T-Shirt', price: 19.99, image: 'assets/images/product2.jpg', category: 'Fashion' },
    { id: 3, name: 'Coffee Maker', price: 89.99, image: 'assets/images/product3.jpg', category: 'Home & Garden' },
    { id: 4, name: 'Running Shoes', price: 79.99, image: 'assets/images/product4.jpg', category: 'Sports' },
    { id: 5, name: 'Novel Book', price: 12.99, image: 'assets/images/product5.jpg', category: 'Books' },
    { id: 6, name: 'Lipstick', price: 24.99, image: 'assets/images/product6.jpg', category: 'Beauty' },
    { id: 7, name: 'Car Parts', price: 49.99, image: 'assets/images/product7.jpg', category: 'Automotive' },
    { id: 8, name: 'Action Figure', price: 15.99, image: 'assets/images/product8.jpg', category: 'Toys' },
    { id: 9, name: 'Laptop', price: 699.99, image: 'assets/images/product9.jpg', category: 'Electronics' },
    { id: 10, name: 'Dress', price: 59.99, image: 'assets/images/product10.jpg', category: 'Fashion' },
    { id: 11, name: 'Plant Pot', price: 14.99, image: 'assets/images/product11.jpg', category: 'Home & Garden' },
    { id: 12, name: 'Tennis Racket', price: 99.99, image: 'assets/images/product12.jpg', category: 'Sports' }
  ];

  selectedLanguage = 'EN';
  
  constructor() { }

  onCategoryClick(category: Category) {
    console.log('Category clicked:', category.name);
  }

  onProductClick(product: Product) {
    console.log('Product clicked:', product.name);
  }

  onCartClick() {
    console.log('Cart clicked');
  }

  onSignUpClick() {
    console.log('Sign up clicked');
  }

  onLanguageChange(language: string) {
    this.selectedLanguage = language;
    console.log('Language changed to:', language);
  }}