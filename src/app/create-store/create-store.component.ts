// src/app/create-store/create-store.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';

// Angular Material Imports
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';

interface SelectedPlan {
  id: number;
  grade: string;
  title: string;
  price: number;
  templates: number;
}

@Component({
  selector: 'app-create-store',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule
  ],
  templateUrl: './create-store.component.html',
  styleUrls: ['./create-store.component.css']
})
export class CreateStoreComponent implements OnInit {

  selectedPlan: SelectedPlan | null = null;
  motivationalTexts = [
    "Turn your passion into profit!",
    "Your success story starts here!",
    "Build the store of your dreams!",
    "Join thousands of successful sellers!"
  ];
  
  currentMotivationIndex = 0;

  benefits = [
    {
      icon: 'store',
      title: 'Professional Store',
      description: 'Get a beautiful, mobile-responsive store'
    },
    {
      icon: 'trending_up',
      title: 'Grow Your Business',
      description: 'Reach customers worldwide and increase sales'
    },
    {
      icon: 'support_agent',
      title: '24/7 Support',
      description: 'Get help whenever you need it'
    },
    {
      icon: 'analytics',
      title: 'Detailed Analytics',
      description: 'Track your performance with powerful insights'
    }
  ];

  constructor(
    private router: Router,
    private route: ActivatedRoute
  ) { }

  ngOnInit() {
    // Get selected plan from session storage
    const savedPlan = sessionStorage.getItem('selectedPlan');
    if (savedPlan) {
      this.selectedPlan = JSON.parse(savedPlan);
    }

    // Get plan from query parameters if available
    this.route.queryParams.subscribe(params => {
      if (params['plan']) {
        // You could fetch plan details based on plan ID
        console.log('Plan ID from query:', params['plan']);
      }
    });

    // Start motivation text rotation
    this.startMotivationRotation();
  }

  startMotivationRotation() {
    setInterval(() => {
      this.currentMotivationIndex = 
        (this.currentMotivationIndex + 1) % this.motivationalTexts.length;
    }, 3000); // Change every 3 seconds
  }

  getCurrentMotivation(): string {
    return this.motivationalTexts[this.currentMotivationIndex];
  }

  // Start store creation process
  startNow() {
    console.log('Starting store creation process');
    console.log('Selected plan:', this.selectedPlan);

    // Here you would typically navigate to store setup wizard
    // this.router.navigate(['/store-setup']);
    
    // For now, show alert
    alert('Redirecting to store setup wizard...\n\nYou\'ll be able to:\n• Choose your store template\n• Add your first products\n• Customize your store design\n• Set up payment methods');
    
    // Navigate to a dashboard or store setup
    // this.router.navigate(['/seller-dashboard']);
  }

  // Navigation methods
  goBack() {
    this.router.navigate(['/pricing']);
  }

  goHome() {
    this.router.navigate(['/']);
  }

  // View plan details
  viewPlanDetails() {
    if (this.selectedPlan) {
      alert(`Your ${this.selectedPlan.title} Plan includes:\n• ${this.selectedPlan.templates} store template${this.selectedPlan.templates > 1 ? 's' : ''}\n• All premium features\n• Priority support`);
    }
  }

  // Get started with tutorials
  viewTutorials() {
    alert('Opening seller tutorials and guides...');
  }

  // Contact support
  contactSupport() {
    alert('Opening support chat...');
  }
}