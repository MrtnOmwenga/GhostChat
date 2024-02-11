const ADD_CONTACT = 'ADD_CONTACT';
const UPDATE_CONTACT = 'UPDATE_CONTACT';
const UPDATE_RECIPIENT = 'UPDATE_RECIPIENT';

export const AddContact = (contact) => ({
  type: ADD_CONTACT,
  payload: contact,
});

export const UpdateContact = (id, contact) => ({
  type: UPDATE_CONTACT,
  payload: {
    id,
    content: contact,
  },
});

export const UpdateRecipient = (recipient) => ({
  type: UPDATE_RECIPIENT,
  payload: recipient,
});
