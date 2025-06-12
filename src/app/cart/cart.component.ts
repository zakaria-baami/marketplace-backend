// src/app/cart/cart.component.ts
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
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDividerModule } from '@angular/material/divider';

interface CartItem {
  id: number;
  name: string;
  price: number;
  image: string;
  quantity: number;
  selected: boolean;
  options?: {[key: string]: string};
}

@Component({
  selector: 'app-cart',
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
    MatCheckboxModule,
    MatDividerModule
  ],
  templateUrl: './cart.component.html',
  styleUrls: ['./cart.component.css']
})
export class CartComponent {
  
  selectedLanguage = 'EN';

  // Mock cart items
  cartItems: CartItem[] = [
    {
      id: 1,
      name: 'Nom de l\'article',
      price: 25.99,
      image: 'assets/images/product1.jpg',
      quantity: 1,
      selected: true,
      options: { 'Size': 'Medium', 'Color': 'Blue' }
    },
    {
      id: 2,
      name: 'Nom de l\'article',
      price: 15.50,
      image: 'assets/images/product2.jpg',
      quantity: 2,
      selected: false,
      options: { 'Size': 'Large', 'Color': 'Red' }
    },
    {
      id: 3,
      name: 'Nom de l\'article',
      price: 89.99,
      image: 'assets/images/product3.jpg',
      quantity: 1,
      selected: true,
      options: { 'Size': 'Small', 'Color': 'Black' }
    },
    {
      id: 4,
      name: 'Nom de l\'article',
      price: 42.75,
      image: 'assets/images/product4.jpg',
      quantity: 3,
      selected: false,
      options: { 'Size': 'X-Large', 'Color': 'White' }
    }
  ];

  constructor() { }

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

  // Cart functionality methods
  toggleItemSelection(item: CartItem) {
    item.selected = !item.selected;
    console.log('Item selection toggled:', item.name, item.selected);
  }

  removeItem(item: CartItem) {
    const index = this.cartItems.findIndex(cartItem => cartItem.id === item.id);
    if (index > -1) {
      this.cartItems.splice(index, 1);
      console.log('Item removed:', item.name);
    }
  }

  updateQuantity(item: CartItem, newQuantity: number) {
    if (newQuantity > 0) {
      item.quantity = newQuantity;
      console.log('Quantity updated:', item.name, newQuantity);
    }
  }

  // Calculate totals
  getSelectedItems(): CartItem[] {
    return this.cartItems.filter(item => item.selected);
  }

  getTotalPrice(): number {
    return this.getSelectedItems().reduce((total, item) => {
      return total + (item.price * item.quantity);
    }, 0);
  }

  getTotalItems(): number {
    return this.getSelectedItems().reduce((total, item) => {
      return total + item.quantity;
    }, 0);
  }

  // Select/Deselect all items
  selectAllItems() {
    const allSelected = this.cartItems.every(item => item.selected);
    this.cartItems.forEach(item => {
      item.selected = !allSelected;
    });
  }

  areAllItemsSelected(): boolean {
    return this.cartItems.length > 0 && this.cartItems.every(item => item.selected);
  }

  // Proceed to checkout
  proceedToOrder() {
    const selectedItems = this.getSelectedItems();
    if (selectedItems.length === 0) {
      alert('Please select at least one item to proceed with the order.');
      return;
    }

    console.log('Proceeding to order with items:', selectedItems);
    console.log('Total amount:', this.getTotalPrice());
    
    // Here you would typically navigate to checkout page
    // this.router.navigate(['/checkout']);
    
    alert(`Proceeding to checkout with ${selectedItems.length} items. Total: $${this.getTotalPrice().toFixed(2)}`);
  }

  // Clear cart
  clearCart() {
    if (confirm('Are you sure you want to clear your cart?')) {
      this.cartItems = [];
      console.log('Cart cleared');
    }
  }
}