// src/app/category-products/category-products.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';

// Angular Material Imports
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatCardModule } from '@angular/material/card';
import { MatMenuModule } from '@angular/material/menu';
import { MatChipsModule } from '@angular/material/chips';

interface Product {
  id: number;
  name: string;
  price: number;
  image: string;
  category: string;
  rating: number;
  inStock: boolean;
  seller: string;
}

interface Category {
  id: string;
  name: string;
  displayName: string;
}

@Component({
  selector: 'app-category-products',
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
    MatMenuModule,
    MatChipsModule
  ],
  templateUrl: './category-products.component.html',
  styleUrls: ['./category-products.component.css']
})
export class CategoryProductsComponent implements OnInit {
  
  selectedLanguage = 'EN';
  categoryName = '';
  categoryId = '';
  
  // Sorting and filtering
  sortBy = 'name';
  sortOrder = 'asc';
  priceRange = { min: 0, max: 1000 };
  
  // All available categories
  categories: Category[] = [
    { id: 'electronics', name: 'Electronics', displayName: 'Electronics' },
    { id: 'fashion', name: 'Fashion', displayName: 'Fashion' },
    { id: 'home-garden', name: 'Home & Garden', displayName: 'Home & Garden' },
    { id: 'sports', name: 'Sports', displayName: 'Sports' },
    { id: 'books', name: 'Books', displayName: 'Books' },
    { id: 'beauty', name: 'Beauty', displayName: 'Beauty' }
  ];

  // Mock products data - in real app this would come from API
  allProducts: Product[] = [
    // Electronics
    { id: 1, name: 'Smartphone Pro', price: 899.99, image: 'assets/images/phone.jpg', category: 'Electronics', rating: 4.5, inStock: true, seller: 'TechStore' },
    { id: 2, name: 'Wireless Headphones', price: 199.99, image: 'assets/images/headphones.jpg', category: 'Electronics', rating: 4.2, inStock: true, seller: 'AudioHub' },
    { id: 3, name: 'Laptop Gaming', price: 1299.99, image: 'assets/images/laptop.jpg', category: 'Electronics', rating: 4.7, inStock: false, seller: 'GameTech' },
    { id: 4, name: 'Smart Watch', price: 299.99, image: 'assets/images/watch.jpg', category: 'Electronics', rating: 4.3, inStock: true, seller: 'WearTech' },
    { id: 5, name: 'Tablet 10inch', price: 449.99, image: 'assets/images/tablet.jpg', category: 'Electronics', rating: 4.1, inStock: true, seller: 'TechStore' },
    { id: 6, name: 'Bluetooth Speaker', price: 79.99, image: 'assets/images/speaker.jpg', category: 'Electronics', rating: 4.4, inStock: true, seller: 'AudioHub' },
    
    // Fashion
    { id: 7, name: 'Designer T-Shirt', price: 29.99, image: 'assets/images/tshirt.jpg', category: 'Fashion', rating: 4.0, inStock: true, seller: 'FashionWorld' },
    { id: 8, name: 'Jeans Classic', price: 79.99, image: 'assets/images/jeans.jpg', category: 'Fashion', rating: 4.2, inStock: true, seller: 'DenimCo' },
    { id: 9, name: 'Summer Dress', price: 89.99, image: 'assets/images/dress.jpg', category: 'Fashion', rating: 4.6, inStock: true, seller: 'StyleHub' },
    { id: 10, name: 'Running Shoes', price: 129.99, image: 'assets/images/shoes.jpg', category: 'Fashion', rating: 4.5, inStock: false, seller: 'SportStyle' },
    { id: 11, name: 'Winter Jacket', price: 149.99, image: 'assets/images/jacket.jpg', category: 'Fashion', rating: 4.3, inStock: true, seller: 'WinterWear' },
    { id: 12, name: 'Casual Sneakers', price: 99.99, image: 'assets/images/sneakers.jpg', category: 'Fashion', rating: 4.1, inStock: true, seller: 'FootFashion' },
    
    // Home & Garden
    { id: 13, name: 'Coffee Maker Deluxe', price: 199.99, image: 'assets/images/coffee.jpg', category: 'Home & Garden', rating: 4.4, inStock: true, seller: 'HomeEssentials' },
    { id: 14, name: 'Plant Pot Set', price: 34.99, image: 'assets/images/pots.jpg', category: 'Home & Garden', rating: 4.2, inStock: true, seller: 'GreenThumb' },
    { id: 15, name: 'Kitchen Knife Set', price: 89.99, image: 'assets/images/knives.jpg', category: 'Home & Garden', rating: 4.7, inStock: true, seller: 'KitchenPro' },
    { id: 16, name: 'Garden Hose', price: 45.99, image: 'assets/images/hose.jpg', category: 'Home & Garden', rating: 4.0, inStock: true, seller: 'GardenTools' },
    { id: 17, name: 'Decorative Lamp', price: 129.99, image: 'assets/images/lamp.jpg', category: 'Home & Garden', rating: 4.3, inStock: false, seller: 'LightingCo' },
    { id: 18, name: 'Throw Pillow Set', price: 39.99, image: 'assets/images/pillows.jpg', category: 'Home & Garden', rating: 4.1, inStock: true, seller: 'ComfortHome' },
    
    // Sports
    { id: 19, name: 'Tennis Racket Pro', price: 159.99, image: 'assets/images/racket.jpg', category: 'Sports', rating: 4.6, inStock: true, seller: 'SportsPro' },
    { id: 20, name: 'Yoga Mat Premium', price: 49.99, image: 'assets/images/yoga.jpg', category: 'Sports', rating: 4.4, inStock: true, seller: 'FitLife' },
    { id: 21, name: 'Dumbbells Set', price: 199.99, image: 'assets/images/dumbbells.jpg', category: 'Sports', rating: 4.5, inStock: true, seller: 'GymEquip' },
    { id: 22, name: 'Football Official', price: 29.99, image: 'assets/images/football.jpg', category: 'Sports', rating: 4.2, inStock: false, seller: 'TeamSports' },
    { id: 23, name: 'Basketball Hoop', price: 299.99, image: 'assets/images/hoop.jpg', category: 'Sports', rating: 4.3, inStock: true, seller: 'CourtKing' },
    { id: 24, name: 'Bike Helmet', price: 79.99, image: 'assets/images/helmet.jpg', category: 'Sports', rating: 4.7, inStock: true, seller: 'SafeRide' }
  ];

  // Current filtered products
  products: Product[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router
  ) { }

  ngOnInit() {
    // Get category from route parameter
    this.route.params.subscribe(params => {
      this.categoryId = params['category'];
      this.updateCategoryInfo();
      this.filterProductsByCategory();
    });
  }

  updateCategoryInfo() {
    const category = this.categories.find(cat => cat.id === this.categoryId);
    this.categoryName = category ? category.displayName : 'All Products';
  }

  filterProductsByCategory() {
    const category = this.categories.find(cat => cat.id === this.categoryId);
    if (category) {
      this.products = this.allProducts.filter(product => 
        product.category === category.displayName
      );
    } else {
      this.products = [...this.allProducts];
    }
    this.sortProducts();
  }

  // Header methods
  onCartClick() {
    this.router.navigate(['/cart']);
  }

  onSignUpClick() {
    this.router.navigate(['/signup']);
  }

  onLanguageChange(language: string) {
    this.selectedLanguage = language;
  }

  // Product interaction
  onProductClick(product: Product) {
    this.router.navigate(['/product', product.id]);
  }

  // Sorting and filtering
  onSortChange(sortBy: string) {
    this.sortBy = sortBy;
    this.sortProducts();
  }

  toggleSortOrder() {
    this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
    this.sortProducts();
  }

  sortProducts() {
    this.products.sort((a, b) => {
      let comparison = 0;
      
      switch (this.sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'price':
          comparison = a.price - b.price;
          break;
        case 'rating':
          comparison = a.rating - b.rating;
          break;
        default:
          comparison = 0;
      }
      
      return this.sortOrder === 'asc' ? comparison : -comparison;
    });
  }

  // Filter methods
  showFilterOptions() {
    // Toggle filter panel or open filter dialog
    console.log('Show filter options');
  }

  // Navigation
  goHome() {
    this.router.navigate(['/']);
  }
}
