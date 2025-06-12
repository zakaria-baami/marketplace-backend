// src/app/store-template-2/store-template-2.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
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
  isNew?: boolean;
  onSale?: boolean;
}

interface Category {
  id: number;
  name: string;
  icon: string;
  count: number;
}

interface Testimonial {
  name: string;
  rating: number;
  comment: string;
  avatar: string;
}

@Component({
  selector: 'app-store-template-2',
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
  templateUrl: './store-template-2.component.html',
  styleUrls: ['./store-template-2.component.css']
})
export class StoreTemplate2Component implements OnInit {

  // Interval for testimonial rotation
  private testimonialInterval: any;

  // Store Information (Demo Data)
  storeInfo = {
    name: 'TechHub Pro',
    description: 'Your premium destination for cutting-edge technology and innovative solutions.',
    slogan: 'Innovation Meets Excellence',
    logo: 'storefront',
    phone: '+1 (555) 987-6543',
    email: 'hello@techhubpro.com',
    address: '456 Innovation Drive, Tech City, TC 54321',
    rating: 4.8,
    totalReviews: 1247,
    established: '2019'
  };

  // Hero Banner
  heroBanner = {
    title: 'Discover the Future of Technology',
    subtitle: 'Premium products with professional service',
    buttonText: 'Shop Now',
    backgroundImage: 'assets/images/hero-bg.jpg'
  };

  // Categories (Demo Data)
  categories: Category[] = [
    { id: 1, name: 'Smartphones', icon: 'smartphone', count: 45 },
    { id: 2, name: 'Laptops', icon: 'laptop', count: 32 },
    { id: 3, name: 'Audio', icon: 'headset', count: 28 },
    { id: 4, name: 'Wearables', icon: 'watch', count: 19 },
    { id: 5, name: 'Gaming', icon: 'sports_esports', count: 37 },
    { id: 6, name: 'Accessories', icon: 'cable', count: 64 }
  ];

  // Featured Products (Demo Data)
  featuredProducts: Product[] = [
    {
      id: 1,
      name: 'iPhone 15 Pro Max',
      price: 1199.99,
      image: 'assets/images/iphone.jpg',
      description: 'Latest flagship smartphone with titanium design and A17 Pro chip',
      rating: 4.9,
      badge: 'Bestseller',
      isNew: true
    },
    {
      id: 2,
      name: 'MacBook Pro 16"',
      price: 2399.99,
      originalPrice: 2599.99,
      image: 'assets/images/macbook.jpg',
      description: 'Powerful laptop for professionals with M3 Max chip',
      rating: 4.8,
      onSale: true
    },
    {
      id: 3,
      name: 'AirPods Pro 3',
      price: 249.99,
      image: 'assets/images/airpods.jpg',
      description: 'Advanced noise cancellation with spatial audio',
      rating: 4.7,
      isNew: true
    },
    {
      id: 4,
      name: 'Apple Watch Ultra 2',
      price: 799.99,
      image: 'assets/images/watch.jpg',
      description: 'Ultimate sports watch with titanium case',
      rating: 4.8,
      badge: 'Premium'
    },
    {
      id: 5,
      name: 'iPad Pro 12.9"',
      price: 1099.99,
      originalPrice: 1199.99,
      image: 'assets/images/ipad.jpg',
      description: 'Professional tablet with M2 chip and Liquid Retina display',
      rating: 4.6,
      onSale: true
    },
    {
      id: 6,
      name: 'Studio Display',
      price: 1599.99,
      image: 'assets/images/display.jpg',
      description: '27-inch 5K Retina display with True Tone',
      rating: 4.5,
      badge: 'Professional'
    }
  ];

  // Customer Testimonials
  testimonials: Testimonial[] = [
    {
      name: 'Sarah Johnson',
      rating: 5,
      comment: 'Amazing service and quality products. Highly recommended!',
      avatar: 'face'
    },
    {
      name: 'Mike Chen',
      rating: 5,
      comment: 'Fast shipping and excellent customer support. Will buy again.',
      avatar: 'face_2'
    },
    {
      name: 'Emma Davis',
      rating: 4,
      comment: 'Great selection of tech products. Very professional store.',
      avatar: 'face_3'
    }
  ];

  // Current testimonial index for rotation
  currentTestimonialIndex = 0;

  constructor() { }

  ngOnInit() {
    // Start testimonial rotation
    //setInterval(() => {
     // this.currentTestimonialIndex = 
    //    (this.currentTestimonialIndex + 1) % this.testimonials.length;
    //}, 4000);
  }

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
    console.log('Hero button clicked');
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

  // Newsletter signup
  onNewsletterSignup() {
    console.log('Newsletter signup');
  }

  // Helper method for total products count
  getTotalProductsCount(): number {
    return this.categories.reduce((sum, cat) => sum + cat.count, 0);
  }

  // Navigation
  goBackToTemplates() {
    console.log('Going back to template selection');
  }
}