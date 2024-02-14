const Joi = require('joi');
const mongoose = require('mongoose');
const Users = require('../models/user.model');

// Function to chack if username exists
const isUsernameUnique = async (value, helpers) => {
  try {
    // Check that user doesn't exist
    const existingUser = await Users.findOne({ username: value });
    if (existingUser) {
      throw new Error('Username must be unique.');
    }

    // Return value if user doesn't exist
    return value;
  } catch (error) {
    throw new Error(error.message);
  }
}

// Check if user exists
const UserExists = async (value) => {
  try {
    const user = await Users.findById(value);
    if (!user) {
      throw new Error('User not found.');
    }

    return value
  } catch (error) {
    throw new Error(error.message);
  }
  
}


// Function to check id is valid user id
const validateMongoId = (value, helpers) => {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    throw new Error('Invalid MongoDB ID.');
  }

  return value;
}

// Define custom validation rule to check for suspicious characters
const noSuspiciousCharacters = (value, helpers) => {
  if (/[^a-zA-Z0-9-_ ]/.test(value)) {
    return helpers.error('any.invalid');
  }
  return value;
};

// Username validation requirements
const usernameSchema = Joi.string().required().min(3).custom(noSuspiciousCharacters, 'no suspicious characters').messages({
  'any.required': 'Username is required.',
  'string.empty': 'Username cannot be empty.',
  'string.min': 'Username must have at least 3 characters.',
  'any.invalid': 'Username contains disallowed characters.'
});

// Search validation
const searchSchema = Joi.string().required().custom(noSuspiciousCharacters, 'no suspicious characters').messages({
  'any.required': 'Username is required.',
  'string.empty': 'Username cannot be empty.',
  'any.invalid': 'Username contains disallowed characters.'
});

// Password validation requirements
const passwordSchema = Joi.string().min(6).required().messages({
  'any.required': 'Password is required.',
  'string.empty': 'Password cannot be empty.',
  'string.min': 'Password must be at least 6 characters long.',
});

// ID validation reqiorements
const idSchema = Joi.string().custom(validateMongoId, 'MongoDB ID validation')

// Validation for user object
const ValidateUser = (user) => {
  const schema = Joi.object({
    username: usernameSchema,
    password: passwordSchema,
  });

  return schema.validate(user);
}

// Validate ID
const ValidateMongoId = (id) => {
  return idSchema.validate(id);
}

// Validate login credentials
const ValidateLogin = (login) => {
  const schema = Joi.object({
    username: usernameSchema,
    password: passwordSchema,
  });

  return schema.validate(login);
}

const ValidateSearch = (search) => {
  const schema = Joi.object({
    username: searchSchema,
    user: usernameSchema,
  });

  return schema.validate(search);
}

module.exports = {
  ValidateMongoId,
  ValidateUser,
  ValidateLogin,
  UserExists,
  isUsernameUnique,
  ValidateSearch,
}