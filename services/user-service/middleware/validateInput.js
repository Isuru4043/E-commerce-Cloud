/**
 * Input Validation Middleware
 * 
 * Validates request body fields before they reach controllers.
 * Keeps validation logic separate from business logic (clean architecture).
 */

// Validate user registration input
export const validateRegister = (req, res, next) => {
  const { name, email, password } = req.body;
  const errors = [];

  if (!name || name.trim().length === 0) {
    errors.push('Name is required');
  }

  if (!email || !email.match(/^\S+@\S+\.\S+$/)) {
    errors.push('Valid email is required');
  }

  if (!password || password.length < 6) {
    errors.push('Password must be at least 6 characters');
  }

  if (errors.length > 0) {
    res.status(400);
    throw new Error(errors.join(', '));
  }

  next();
};

// Validate login input
export const validateLogin = (req, res, next) => {
  const { email, password } = req.body;
  const errors = [];

  if (!email || !email.match(/^\S+@\S+\.\S+$/)) {
    errors.push('Valid email is required');
  }

  if (!password || password.length === 0) {
    errors.push('Password is required');
  }

  if (errors.length > 0) {
    res.status(400);
    throw new Error(errors.join(', '));
  }

  next();
};

// Validate profile update
export const validateProfileUpdate = (req, res, next) => {
  const { email, password } = req.body;

  if (email && !email.match(/^\S+@\S+\.\S+$/)) {
    res.status(400);
    throw new Error('Valid email format is required');
  }

  if (password && password.length < 6) {
    res.status(400);
    throw new Error('Password must be at least 6 characters');
  }

  next();
};
