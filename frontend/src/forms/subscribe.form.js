import React, { useState } from 'react';
import SubStyle from '../assets/form-styles/subscribe.module.css';

const SubscribeForm = () => {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');

  const onChange = (event) => {
    setEmail(event.target.value);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    setMessage(`Thank you ${email}`);
    setEmail('');
    setTimeout(() => {
      setMessage('');
    }, 5000);
  };

  return (
    <form className={SubStyle.subscribe} onSubmit={handleSubmit}>
      <label htmlFor="email">
        <input type="email" id="email" name="email" onChange={onChange} placeholder="example@gmail.com" />
        <button type="submit"> Submit </button>
      </label>
      <p>{message}</p>
    </form>
  );
};

export default SubscribeForm;
