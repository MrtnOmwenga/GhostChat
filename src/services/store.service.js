import { createStore } from 'redux';

// Action Types
const ADD_MESSAGE = 'ADD_MESSAGE';
const RECEIVE_MESSAGE = 'RECEIVE_MESSAGE';
const ADD_CONTACT = 'ADD_CONTACT';
const UPDATE_CONTACT = 'UPDATE_CONTACT';
const UPDATE_RECIPIENT = 'UPDATE_RECIPIENT';
const UPDATE_RECIPIENT_SOCKET = 'UPDATE_RECIPIENT_SOCKET';

const initialState = {
  recipient: null,
  messages: [],
  contacts: [],
};

const Reducer = (state = initialState, action = {}) => {
  let id;
  switch (action?.type) {
    case ADD_MESSAGE:
      if (action.payload) {
        return {
          ...state,
          messages: [...state.messages, { ...action.payload, fromMe: true }],
        };
      }
      break;

    case RECEIVE_MESSAGE:
      if (action.payload) {
        return {
          ...state,
          messages: [...state.messages, { ...action.payload, fromMe: false }],
        };
      }
      break;

    case ADD_CONTACT:
      if (action.payload) {
        // Check if the contact with the same id already exists
        if (state.contacts.some((contact) => contact.id === action.payload.id)) {
          // If the contact already exists, don't add it again
          return state;
        }
        // If the contact doesn't exist, add it to the contacts array
        return {
          ...state,
          contacts: [...state.contacts, action.payload],
        };
      }
      break;

    case UPDATE_CONTACT:
      if (action.payload && action.payload.id && action.payload.content) {
        id = action.payload.id;
        return {
          ...state,
          contacts: state.contacts.map((contact) => (
            contact.id !== id ? contact : { ...action.payload.content, ...contact }
          )),
        };
      }
      break;

    case UPDATE_RECIPIENT:
      if (action.payload) {
        return {
          ...state,
          recipient: action.payload,
        };
      }
      break;

    case UPDATE_RECIPIENT_SOCKET:
      if (action.payload && state.recipient && action.payload.id && action.payload.content) {
        if (action.payload.id === state.recipient.id) {
          return { ...state, recipient: { ...state.recipient, ...action.payload.content } };
        }
        return state;
      }
      break;
    default:
      return state;
  }

  return state;
};

const store = createStore(Reducer);

store.subscribe(() => {
  // Log the current state whenever the store changes
  console.log('Current state:', store.getState());
});

export default store;
