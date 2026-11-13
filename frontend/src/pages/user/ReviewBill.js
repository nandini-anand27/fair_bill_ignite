import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { billAPI } from '../../services/api';

export default function ReviewBill() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [bill, setBill] = useState(null);
  const [items, setItems] = useState([]);
  const [billInfo, setBillInfo] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [sumCheck, setSumCheck] = useState(null);

  useEffect(() => {
    loadBill();
  }, [id]);

  const loadBill = async () => {
    try {
      const res = await billAPI.detail(id);
      setBill(res.data);
      setItems(res.data.items.map(it => ({
        id: it.id,
        description: it.raw_description || it.item_key,
        item_key: it.item_key,
        amount: (it.amount_paise / 100).toFixed(2),
        quantity: it.quantity,
        category: it.category,
      })));
      setBillInfo({
        hospital_name: res.data.hospital_name || '',
        bill_date: res.data.bill_date || '',
        room_category: res.data.room_category || 'general',
      });
    } catch (err) {
      setError('Failed to load bill.');
    } finally {
      setLoading(false);
    }
  };

  const addItem = () => setItems([...items, { description: '', amount: '', quantity: 1, category: 'other' }]);
  const removeItem = (i) => setItems(items.filter((_, idx) => idx !== i));
  const updateItem = (i, field, val) => setItems(items.map((it, idx) => idx === i ? { ...it, [field]: val } : it));

  const computedTotal = items.reduce((sum, it) => sum + (parseFloat(it.amount) || 0) * (parseInt(it.quantity) || 1), 0);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const payload = {
        ...billInfo,
        items: items.map(it => ({
          description: it.description,
          amount: parseFloat(it.amount) || 0,
          quantity: parseInt(it.quantity) || 1,
          category: it.category,
          item_key: it.item_key,
        })),
      };
      const res = await billAPI.update(id, payload);
      setSumCheck(res.data.sum_check);
      navigate(`/results/${id}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleCompare = async () => {
    setSaving(true);
    setError('');
    try {
      // Save first
      const payload = {
        ...billInfo,
        items: items.map(it => ({
          description: it.description,
          amount: parseFloat(it.amount) || 0,
          quantity: parseInt(it.quantity) || 1,
          category: it.category,
          item_key: it.item_key,
        })),
      };
      await billAPI.update(id, payload);
      // Then compare
      await billAPI.compare(id, billInfo);
      navigate(`/results/${id}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Comparison failed. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="loading-overlay"><div className="spinner" /></div>;
  if (!bill) return <div className="alert alert-danger">Bill not found.</div>;

  const formatRupees = (paise) => `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

  return (
    <div>
      <h2 className="mb-2">Review & Edit Bill</h2>
      <p className="text-muted mb-2">Check the extracted line items against your bill. Edit any incorrect amounts or descriptions.</p>

      {error && <div className="alert alert-danger">{error}</div>}

      {sumCheck && !sumCheck.matches && (
        <div className="alert alert-warning">
          <strong>Sum mismatch:</strong> The line items add up to {formatRupees(sumCheck.computed_total_paise)}
          but the printed total is {formatRupees(sumCheck.printed_total_paise)}. Please review and correct.
        </div>
      )}

      <div className="card">
        <div className="card-header">Bill Details</div>
        <div className="form-group">
          <label>Hospital Name</label>
          <input type="text" value={billInfo.hospital_name}
            onChange={(e) => setBillInfo({ ...billInfo, hospital_name: e.target.value })}
            placeholder="Hospital name" />
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
      </div>

      <div className="card">
        <div className="flex-between">
          <span className="card-header" style={{ border: 'none', padding: 0 }}>Line Items</span>
          <span className="text-muted" style={{ fontWeight: 600 }}>
            Computed Total: ₹{computedTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </span>
        </div>
        <table className="bill-items-table">
          <thead>
            <tr>
              <th>Description</th>
              <th style={{ width: '120px' }}>Amount (₹)</th>
              <th style={{ width: '80px' }}>Qty</th>
              <th style={{ width: '130px' }}>Category</th>
              <th style={{ width: '50px' }}></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={i}>
                <td>
                  <input type="text" value={item.description}
                    onChange={(e) => updateItem(i, 'description', e.target.value)} />
                </td>
                <td>
                  <input type="number" step="0.01" value={item.amount}
                    onChange={(e) => updateItem(i, 'amount', e.target.value)} />
                </td>
                <td>
                  <input type="number" value={item.quantity}
                    onChange={(e) => updateItem(i, 'quantity', e.target.value)} min="1" />
                </td>
                <td>
                  <select value={item.category}
                    onChange={(e) => updateItem(i, 'category', e.target.value)}>
                    <option value="room">Room</option>
                    <option value="doctor_fees">Doctor Fees</option>
                    <option value="nursing">Nursing</option>
                    <option value="medicines">Medicines</option>
                    <option value="consumables">Consumables</option>
                    <option value="baby_charges">Baby Charges</option>
                    <option value="tests">Tests</option>
                    <option value="other">Other</option>
                  </select>
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

      <div className="flex gap-1">
        <button className="btn btn-primary btn-block btn-lg" onClick={handleCompare} disabled={saving}>
          {saving ? 'Comparing...' : 'Compare with Peers'}
        </button>
      </div>
    </div>
  );
}
