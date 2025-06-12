// src/app/user-type-selection/user-type-selection.component.ts
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';

// Angular Material Imports
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';

@Component({
  selector: 'app-user-type-selection',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule
  ],
  templateUrl: './user-type-selection.component.html',
  styleUrls: ['./user-type-selection.component.css']
})
export class UserTypeSelectionComponent {

  constructor(private router: Router) { }

  // Navigate to seller registration
  selectCreator() {
    console.log('Creator/Seller selected');
    // Navigate to seller registration page
    // this.router.navigate(['/register/seller']);
    
    // For now, just show an alert
    alert('Redirecting to Seller Registration...');
  }

  // Navigate to buyer registration
  selectBuyer() {
    console.log('Buyer selected');
    // Navigate to buyer registration page
    // this.router.navigate(['/register/buyer']);
    
    // For now, just show an alert
    alert('Redirecting to Buyer Registration...');
  }

  // Navigate back to home
  goBack() {
    this.router.navigate(['/']);
  }
}