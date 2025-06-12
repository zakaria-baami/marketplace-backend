// src/app/buyer-registration/buyer-registration.component.ts
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';

// Angular Material Imports
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatCardModule } from '@angular/material/card';

@Component({
  selector: 'app-buyer-registration',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatCardModule
  ],
  templateUrl: './buyer-registration.component.html',
  styleUrls: ['./buyer-registration.component.css']
})
export class BuyerRegistrationComponent {

  registrationForm: FormGroup;
  hidePassword = true;
  hideConfirmPassword = true;

  constructor(
    private formBuilder: FormBuilder,
    private router: Router
  ) {
    this.registrationForm = this.formBuilder.group({
      email: ['', [
        Validators.required,
        Validators.email
      ]],
      password: ['', [
        Validators.required,
        Validators.minLength(8)
      ]],
      confirmPassword: ['', [
        Validators.required
      ]]
    }, {
      validators: this.passwordMatchValidator
    });
  }

  // Custom validator to check if passwords match
  passwordMatchValidator(form: FormGroup) {
    const password = form.get('password');
    const confirmPassword = form.get('confirmPassword');
    
    if (password && confirmPassword && password.value !== confirmPassword.value) {
      confirmPassword.setErrors({ passwordMismatch: true });
      return { passwordMismatch: true };
    }
    
    return null;
  }

  // Toggle password visibility
  togglePasswordVisibility() {
    this.hidePassword = !this.hidePassword;
  }

  toggleConfirmPasswordVisibility() {
    this.hideConfirmPassword = !this.hideConfirmPassword;
  }

  // Get form control for easier access in template
  get email() {
    return this.registrationForm.get('email');
  }

  get password() {
    return this.registrationForm.get('password');
  }

  get confirmPassword() {
    return this.registrationForm.get('confirmPassword');
  }

  // Get error messages
  getEmailErrorMessage() {
    if (this.email?.hasError('required')) {
      return 'Email is required';
    }
    if (this.email?.hasError('email')) {
      return 'Please enter a valid email address';
    }
    return '';
  }

  getPasswordErrorMessage() {
    if (this.password?.hasError('required')) {
      return 'Password is required';
    }
    if (this.password?.hasError('minlength')) {
      return 'Password must be at least 8 characters long';
    }
    return '';
  }

  getConfirmPasswordErrorMessage() {
    if (this.confirmPassword?.hasError('required')) {
      return 'Please confirm your password';
    }
    if (this.confirmPassword?.hasError('passwordMismatch')) {
      return 'Passwords do not match';
    }
    return '';
  }

  // Form submission
  onRegister() {
    if (this.registrationForm.valid) {
      const formData = this.registrationForm.value;
      
      console.log('Buyer registration data:', {
        email: formData.email,
        password: formData.password
      });

      // Here you would typically send data to your backend API
      // this.authService.registerBuyer(formData).subscribe(...)
      
      // For now, show success message
      alert(`Registration successful! Welcome ${formData.email}!`);
      
      // Navigate to home or login page
      this.router.navigate(['/']);
      
    } else {
      // Mark all fields as touched to show validation errors
      this.registrationForm.markAllAsTouched();
      console.log('Form is invalid');
    }
  }

  // Navigation methods
  goBack() {
    this.router.navigate(['/signup']);
  }

  goToLogin() {
    // Navigate to login page
    // this.router.navigate(['/login']);
    alert('Redirecting to login page...');
  }
}