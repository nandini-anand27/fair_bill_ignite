import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { billAPI } from '../../services/api';

export default function UploadBill() {
  const navigate = useNavigate();
  const [items, setItems] = useState([{ description: '', amount: '', quantity: 1 }]);
  const [billInfo, setBillInfo] = useState({
    hospital_name: '',
    bill_date: '',
    room_category: 'general',
    printed_total: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const addItem = () => setItems([...items, { description: '', amount: '', quantity: 1 }]);
  const removeItem = (i) => setItems(items.filter((_, idx) => idx !== i));
  const updateItem = (i, field, val) => setItems(items.map((it, idx) => idx === i ? { ...it, [field]: val } : it));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      // Convert rupees to paise for printed_total
      const printedTotalPaise = Math.round(parseFloat(billInfo.printed_total || 0) * 100);

      const payload = {
        hospital_name: billInfo.hospital_name,
        bill_date: billInfo.bill_date || null,
        room_category: billInfo.room_category,
        printed_total_paise: printedTotalPaise,
        items: items.map(it => ({
          description: it.description,
          amount: parseFloat(it.amount) || 0,
          quantity: parseInt(it.quantity) || 1,
        })),
      };

      const res = await billAPI.upload(payload);
      navigate(`/review/${res.data.bill.id}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Upload failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 className="mb-2">Upload Hospital Bill</h2>
      <p className="text-muted mb-2">Enter your normal-delivery bill details below. You can also manually enter line items from your bill.</p>

      {error && <div className="alert alert-danger">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="card">
          <div className="card-header">Bill Information</div>
          <div className="form-group">
            <label>Hospital Name</label>
            <input type="text" value={billInfo.hospital_name}
              onChange={(e) => setBillInfo({ ...billInfo, hospital_name: e.target.value })}
              placeholder="e.g. Manipal Hospital" />
          </div>
          <div className="form-group">
            <label>Bill Date</label>
            <input type="date" value={billInfo.bill_date}
              onChange={(e) => setBillInfo({ ...billInfo, bill_date: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Room Category</label>
            <select value={billInfo.room_category}
              onChange={(e) => setBillInfo({ ...billInfo, room_category: e.target.value })}>
              <option value="general">General</option>
              <option value="semi_private">Semi-Private</option>
              <option value="private">Private</option>
              <option value="premium">Premium</option>
            </select>
          </div>
          <div className="form-group">
            <label>Printed Total (₹)</label>
            <input type="number" step="0.01" value={billInfo.printed_total}
              onChange={(e) => setBillInfo({ ...billInfo, printed_total: e.target.value })}
              placeholder="Total as printed on the bill" />
          </div>
        </div>

        <div className="card">
          <div className="card-header">Line Items</div>
          <table className="bill-items-table">
            <thead>
              <tr>
                <th>Description</th>
                <th style={{ width: '120px' }}>Amount (₹)</th>
                <th style={{ width: '80px' }}>Qty</th>
                <th style={{ width: '50px' }}></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={i}>
                  <td>
                    <input type="text" value={item.description}
                      onChange={(e) => updateItem(i, 'description', e.target.value)}
                      placeholder="e.g. Room rent, Doctor consultation..." required />
                  </td>
                  <td>
                    <input type="number" step="0.01" value={item.amount}
                      onChange={(e) => updateItem(i, 'amount', e.target.value)}
                      placeholder="0.00" required />
                  </td>
                  <td>
                    <input type="number" value={item.quantity}
                      onChange={(e) => updateItem(i, 'quantity', e.target.value)} min="1" />
                  </td>
                  <td>
                    {items.length > 1 && (
                      <button type="button" className="btn btn-danger btn-sm" onClick={() => removeItem(i)}>✕</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button type="button" className="btn btn-secondary mt-1" onClick={addItem}>+ Add Item</button>
        </div>

        <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={loading}>
          {loading ? 'Uploading...' : 'Upload Bill'}
        </button>
      </form>
    </div>
  );
}
