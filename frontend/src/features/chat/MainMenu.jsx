import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import panel from '../../ui/Panel.module.css';
import api from '../../lib/api';
import { signOut } from './ChatPage';
import { accountDeletion } from '../../lib/messaging';
import { signedIn } from '../auth/sessionSlice';

const MainMenu = ({ ChangeView, close }) => {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const receiptsEnabled = useSelector((state) => state.session.user?.receiptsEnabled);

  const toggleReceipts = async () => {
    try {
      const { data } = await api.patch('/users/me/settings', { receiptsEnabled: !receiptsEnabled });
      dispatch(signedIn(data));
      toast.info(data.receiptsEnabled ? 'Read receipts on: you send them and see other people\'s' : 'Read receipts off');
    } catch (error) {
      toast.error(error.message);
    }
  };

  const deleteAccount = async () => {
    // eslint-disable-next-line no-alert
    if (!window.confirm('Delete your account? This cannot be undone.')) return;
    try {
      await api.delete('/users/me', { data: { deletion: await accountDeletion() } });
      await signOut(dispatch, navigate);
    } catch (error) {
      toast.error(error.message);
    }
  };

  return (
    <ul className={panel.menu}>
      <li><button type="button" onClick={() => ChangeView('create')}>Create a room</button></li>
      <li><button type="button" onClick={() => ChangeView('join')}>Join with an invite link</button></li>
      <li>
        <button type="button" role="switch" aria-checked={receiptsEnabled === true} onClick={toggleReceipts}>
          {`Read receipts: ${receiptsEnabled ? 'On' : 'Off'}`}
        </button>
      </li>
      <li><button type="button" onClick={() => ChangeView('password')}>Change password</button></li>
      <li><button type="button" className={panel.danger} onClick={deleteAccount}>Delete account</button></li>
    </ul>
  );
};

export default MainMenu;
