// src/app/login/login.component.ts
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
import { MatCheckboxModule } from '@angular/material/checkbox';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatCardModule,
    MatCheckboxModule
  ],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {

  loginForm: FormGroup;
  hidePassword = true;
  isLoading = false;

  constructor(
    private formBuilder: FormBuilder,
    private router: Router
  ) {
    this.loginForm = this.formBuilder.group({
      emailOrUsername: ['', [
        Validators.required,
        Validators.minLength(3)
      ]],
      password: ['', [
        Validators.required,
        Validators.minLength(6)
      ]],
      rememberMe: [false]
    });
  }

  // Toggle password visibility
  togglePasswordVisibility() {
    this.hidePassword = !this.hidePassword;
  }

  // Get form control for easier access in template
  get emailOrUsername() {
    return this.loginForm.get('emailOrUsername');
  }

  get password() {
    return this.loginForm.get('password');
  }

  get rememberMe() {
    return this.loginForm.get('rememberMe');
  }

  // Get error messages
  getEmailUsernameErrorMessage() {
    if (this.emailOrUsername?.hasError('required')) {
      return 'Email or username is required';
    }
    if (this.emailOrUsername?.hasError('minlength')) {
      return 'Must be at least 3 characters long';
    }
    return '';
  }

  getPasswordErrorMessage() {
    if (this.password?.hasError('required')) {
      return 'Password is required';
    }
    if (this.password?.hasError('minlength')) {
      return 'Password must be at least 6 characters long';
    }
    return '';
  }

  // Form submission
  onLogin() {
    if (this.loginForm.valid) {
      this.isLoading = true;
      const formData = this.loginForm.value;
      
      console.log('Login attempt:', {
        emailOrUsername: formData.emailOrUsername,
        password: formData.password,
        rememberMe: formData.rememberMe
      });

      // Simulate API call
      setTimeout(() => {
        this.isLoading = false;
        
        // Here you would typically send data to your backend API
        // this.authService.login(formData).subscribe(...)
        
        // For now, show success message and redirect
        alert(`Welcome back, ${formData.emailOrUsername}!`);
        
        // Navigate to home page after successful login
        this.router.navigate(['/']);
        
      }, 1500);
      
    } else {
      // Mark all fields as touched to show validation errors
      this.loginForm.markAllAsTouched();
      console.log('Form is invalid');
    }
  }

  // Navigation methods
  goToSignUp() {
    this.router.navigate(['/signup']);
  }

  goToForgotPassword() {
    // Navigate to forgot password page
    // this.router.navigate(['/forgot-password']);
    alert('Redirecting to forgot password page...');
  }

  goHome() {
    this.router.navigate(['/']);
  }

  // Social login methods (for future implementation)
  loginWithGoogle() {
    console.log('Google login clicked');
    alert('Google login will be implemented with backend integration');
  }

  loginWithFacebook() {
    console.log('Facebook login clicked');
    alert('Facebook login will be implemented with backend integration');
  }
}
