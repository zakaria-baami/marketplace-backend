// src/app/pricing-plans/pricing-plans.component.ts
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';

// Angular Material Imports
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';

interface PricingPlan {
  id: number;
  grade: string;
  title: string;
  price: number;
  currency: string;
  period: string;
  description: string;
  features: string[];
  templates: number;
  popular?: boolean;
  buttonText: string;
}

@Component({
  selector: 'app-pricing-plans',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule
  ],
  templateUrl: './pricing-plans.component.html',
  styleUrls: ['./pricing-plans.component.css']
})
export class PricingPlansComponent {

  motivationText = "Choose your grade and unlock your selling potential!";

  pricingPlans: PricingPlan[] = [
    {
      id: 1,
      grade: "Grade 1",
      title: "Amateur",
      price: 0.00,
      currency: "$",
      period: "/month",
      description: "Perfect for beginners starting their selling journey",
      templates: 1,
      features: [
        "1 store template design",
        "Up to 10 products",
        "Basic analytics",
        "Email support",
        "Mobile responsive store",
        "Basic payment processing",
        "Standard listing features"
      ],
      buttonText: "get started"
    },
    {
      id: 2,
      grade: "Grade 2", 
      title: "Professional",
      price: 19.99,
      currency: "$",
      period: "/month",
      description: "Ideal for growing businesses with more features",
      templates: 2,
      popular: true,
      features: [
        "2 store template designs",
        "Up to 100 products", 
        "Advanced analytics & insights",
        "Priority email & chat support",
        "Custom domain support",
        "Advanced payment options",
        "Promotion & discount tools",
        "Inventory management",
        "Customer review system"
      ],
      buttonText: "get started"
    },
    {
      id: 3,
      grade: "Grade 3",
      title: "Premium", 
      price: 49.99,
      currency: "$",
      period: "/month",
      description: "Complete solution for serious sellers and enterprises",
      templates: 4,
      features: [
        "4 premium template designs",
        "Unlimited products",
        "Professional analytics suite",
        "24/7 priority support",
        "Multiple custom domains",
        "Advanced payment gateway",
        "Marketing automation tools",
        "Advanced inventory management",
        "Multi-language support",
        "API access & integrations",
        "White-label options",
        "Dedicated account manager"
      ],
      buttonText: "get started"
    }
  ];

  constructor(private router: Router) { }

  selectPlan(plan: PricingPlan) {
    console.log('Plan selected:', plan);
    
    // Store selected plan in session/local storage if needed
    sessionStorage.setItem('selectedPlan', JSON.stringify(plan));
    
    // Navigate to registration or payment page
    // this.router.navigate(['/register/seller'], { queryParams: { plan: plan.id } });
    
    // For now, show alert
    alert(`You selected ${plan.title} plan! Redirecting to registration...`);
  }

  goBack() {
    this.router.navigate(['/signup']);
  }

  getFeatureIcon(feature: string): string {
    // Return appropriate icons based on feature content
    if (feature.includes('template')) return 'palette';
    if (feature.includes('products')) return 'inventory_2';
    if (feature.includes('analytics')) return 'analytics';
    if (feature.includes('support')) return 'support_agent';
    if (feature.includes('payment')) return 'payment';
    if (feature.includes('domain')) return 'language';
    if (feature.includes('promotion') || feature.includes('discount')) return 'local_offer';
    if (feature.includes('inventory')) return 'warehouse';
    if (feature.includes('review')) return 'star';
    if (feature.includes('marketing')) return 'campaign';
    if (feature.includes('API')) return 'api';
    return 'check_circle';
  }
}