import { randomBytes } from 'node:crypto';

const generateReferenceId = () => {
  return randomBytes(15).toString('hex');
};
export default generateReferenceId;
