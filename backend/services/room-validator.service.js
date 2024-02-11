const Joi = require('joi');
const mongoose = require('mongoose');
const Rooms = require('../models/room.model');

// Function to check if Room name is unique
const isRoomNameUnique = async (value, helpers) => {
  try {
    // Check that user doesn't exist
    const existingRoom = await Rooms.findOne({ name: value });
    if (existingRoom) {
      throw new Error('Room name must be unique.');
    }

    // Return value if room doesn't exist
    return value;
  } catch (error) {
    throw new Error(error.message);
  }
}

const RoomExists = async (value) => {
  const room = await Rooms.findById(value);
  if (!room) {
    throw new Error('Room not found.');
  }

  return value
}

const RoomNameExists = async (value) => {
  const room = await Rooms.find({ name: value });
  if (!room) {
    throw new Error('Room not found.');
  }

  return value
}

// Function to check id is valid user id
const validateMongoId = (value, helpers) => {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    throw new Error('Invalid MongoDB ID.');
  }

  return value;
}

const roomSchema = Joi.string().required().min(3).messages({
  'any.required': 'Room name is required.',
  'string.empty': 'Room name cannot be empty.',
  'string.min': 'Room name must have at least 3 characters.',
});

const passwordSchema = Joi.string().min(6).required().messages({
  'any.required': 'Password is required.',
  'string.empty': 'Password cannot be empty.',
  'string.min': 'Password must be at least 6 characters long.',
});

const idSchema = Joi.string().custom(validateMongoId, 'MongoDB ID validation')

const ValidateJoin = (join) => {
  const schema = Joi.object({
    name: roomSchema.custom(RoomNameExists, 'room exists validation'),
    password: passwordSchema,
  });

  return schema.validate(join);
}

const ValidateRoom = (room) => {
  const schema = Joi.object({
    name: roomSchema,
    password: passwordSchema,
  });

  return schema.validate(room);
}

const ValidateMongoId = (id) => {
  return idSchema.custom(RoomExists, 'Check if room exists').validate(id);
}

module.exports = {
  ValidateJoin,
  ValidateRoom,
  ValidateMongoId,
  isRoomNameUnique,
}