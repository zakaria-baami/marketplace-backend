// src/app/store-template-3/store-template-3.component.ts
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

// Angular Material Imports
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatChipsModule } from '@angular/material/chips';
import { MatBadgeModule } from '@angular/material/badge';

interface Product {
  id: number;
  name: string;
  price: number;
  originalPrice?: number;
  image: string;
  description: string;
  rating: number;
  badge?: string;
  isHot?: boolean;
  isLimited?: boolean;
  color: string; // For creative color themes
}

interface Category {
  id: number;
  name: string;
  icon: string;
  color: string;
  bgColor: string;
}

interface Feature {
  icon: string;
  title: string;
  description: string;
  color: string;
}

@Component({
  selector: 'app-store-template-3',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatToolbarModule,
    MatChipsModule,
    MatBadgeModule
  ],
  templateUrl: './store-template-3.component.html',
  styleUrls: ['./store-template-3.component.css']
})
export class StoreTemplate3Component {

  // Store Information (Demo Data)
  storeInfo = {
    name: 'CreativeHub',
    description: 'Where creativity meets innovation! Discover unique products that inspire.',
    slogan: 'Be Bold. Be Creative. Be You.',
    logo: 'palette',
    phone: '+1 (555) 456-7890',
    email: 'hello@creativehub.com',
    address: '789 Creative Street, Art District, AD 98765',
    founded: '2020',
    totalProducts: 250,
    happyCustomers: 5000
  };

  // Hero Section
  heroData = {
    title: 'Unleash Your Creativity',
    subtitle: 'Discover products that spark imagination',
    cta: 'Explore Now',
    features: ['✨ Handpicked Items', '🚀 Fast Shipping', '💎 Premium Quality']
  };

  // Categories with vibrant colors
  categories: Category[] = [
    { 
      id: 1, 
      name: 'Art Supplies', 
      icon: 'brush', 
      color: '#ff6b6b',
      bgColor: '#fff5f5'
    },
    { 
      id: 2, 
      name: 'Tech Gadgets', 
      icon: 'electrical_services', 
      color: '#4ecdc4',
      bgColor: '#f0fdfc'
    },
    { 
      id: 3, 
      name: 'Home Decor', 
      icon: 'home_filled', 
      color: '#45b7d1',
      bgColor: '#f0f9ff'
    },
    { 
      id: 4, 
      name: 'Fashion', 
      icon: 'checkroom', 
      color: '#f9ca24',
      bgColor: '#fffbeb'
    },
    { 
      id: 5, 
      name: 'Books', 
      icon: 'menu_book', 
      color: '#6c5ce7',
      bgColor: '#f8f7ff'
    },
    { 
      id: 6, 
      name: 'Music', 
      icon: 'music_note', 
      color: '#fd79a8',
      bgColor: '#fef7f7'
    }
  ];

  // Featured Products with creative styling
  featuredProducts: Product[] = [
    {
      id: 1,
      name: 'Digital Art Tablet Pro',
      price: 299.99,
      originalPrice: 399.99,
      image: 'assets/images/tablet.jpg',
      description: 'Professional drawing tablet for digital artists',
      rating: 4.9,
      badge: 'BESTSELLER',
      isHot: true,
      color: '#ff6b6b'
    },
    {
      id: 2,
      name: 'Vintage Camera Kit',
      price: 189.99,
      image: 'assets/images/camera.jpg',
      description: 'Complete vintage photography setup',
      rating: 4.7,
      isLimited: true,
      color: '#4ecdc4'
    },
    {
      id: 3,
      name: 'Smart LED Strip',
      price: 49.99,
      originalPrice: 79.99,
      image: 'assets/images/led.jpg',
      description: 'RGB LED strips with app control',
      rating: 4.5,
      badge: 'SALE',
      color: '#45b7d1'
    },
    {
      id: 4,
      name: 'Artisan Coffee Set',
      price: 129.99,
      image: 'assets/images/coffee-set.jpg',
      description: 'Premium coffee brewing essentials',
      rating: 4.8,
      isHot: true,
      color: '#f9ca24'
    },
    {
      id: 5,
      name: 'Minimalist Desk Lamp',
      price: 79.99,
      originalPrice: 99.99,
      image: 'assets/images/lamp.jpg',
      description: 'Modern LED desk lamp with wireless charging',
      rating: 4.6,
      color: '#6c5ce7'
    },
    {
      id: 6,
      name: 'Bluetooth Speaker Pro',
      price: 199.99,
      image: 'assets/images/speaker-pro.jpg',
      description: 'Premium wireless speaker with 360° sound',
      rating: 4.9,
      badge: 'NEW',
      isLimited: true,
      color: '#fd79a8'
    }
  ];

  // Store Features
  features: Feature[] = [
    {
      icon: 'local_shipping',
      title: 'Free Shipping',
      description: 'On orders over $50',
      color: '#ff6b6b'
    },
    {
      icon: 'autorenew',
      title: '30-Day Returns',
      description: 'Easy return policy',
      color: '#4ecdc4'
    },
    {
      icon: 'verified_user',
      title: 'Secure Payment',
      description: '100% secure checkout',
      color: '#45b7d1'
    },
    {
      icon: 'support_agent',
      title: '24/7 Support',
      description: 'Always here to help',
      color: '#f9ca24'
    }
  ];

  constructor() { }

  // Get star array for rating display
  getStarArray(rating: number): boolean[] {
    return Array(5).fill(false).map((_, i) => i < Math.floor(rating));
  }

  // Product actions
  onProductClick(product: Product) {
    console.log('Product clicked:', product.name);
  }

  onAddToCart(product: Product) {
    console.log('Added to cart:', product.name);
  }

  onQuickView(product: Product) {
    console.log('Quick view:', product.name);
  }

  // Category actions
  onCategoryClick(category: Category) {
    console.log('Category clicked:', category.name);
  }

  // Hero actions
  onHeroButtonClick() {
    console.log('Hero CTA clicked');
  }

  // Contact actions
  onContactPhone() {
    window.open(`tel:${this.storeInfo.phone}`);
  }

  onContactEmail() {
    window.open(`mailto:${this.storeInfo.email}`);
  }

  // Social media actions
  onSocialClick(platform: string) {
    console.log('Social media clicked:', platform);
  }

  // Newsletter
  onNewsletterSignup() {
    console.log('Newsletter signup');
  }

  // Navigation
  goBackToTemplates() {
    console.log('Going back to template selection');
  }
}