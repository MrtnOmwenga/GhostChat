import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

/**
 * /join/<id>#<secret>. The secret is read from the fragment (never sent to the server) and held in
 * sessionStorage while the chat page loads, which also carries it through signing in first.
 */
const JoinPage = () => {
  const { inviteId } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    const secret = window.location.hash.slice(1);
    if (/^[0-9a-f]{24}$/.test(inviteId) && /^[A-Za-z0-9_-]{43}$/.test(secret)) {
      sessionStorage.setItem('pendingInvite', JSON.stringify({ id: inviteId, secret }));
    }
    navigate('/chatpage', { replace: true });
  }, [inviteId, navigate]);

  return null;
};

export default JoinPage;
