import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FaTrash, FaPlus, FaMinus, FaArrowLeft, FaShoppingBag, FaRupeeSign, FaQrcode, FaExclamationTriangle, FaCheckCircle } from "react-icons/fa";
import "./Cart.css";
export default function Cart() {
  const navigate = useNavigate();
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showBill, setShowBill] = useState(false);
  const [billData, setBillData] = useState(null);
  const [stockErrors, setStockErrors] = useState([]);

  useEffect(() => {
    const savedCart = JSON.parse(localStorage.getItem("ib_cart") || "[]");
    setCart(savedCart);
    validateCartStock(savedCart);
  }, []);

  // Validate cart items against current stock
  const validateCartStock = async (cartItems) => {
    const errors = [];
    
    for (const item of cartItems) {
      try {
        const response = await fetch(`http://localhost:5000/api/products/${item._id}`);
        if (response.ok) {
          const freshProduct = await response.json();
          if (freshProduct.quantity < item.qty) {
            errors.push({
              productId: item._id,
              productName: item.name,
              requested: item.qty,
              available: freshProduct.quantity
            });
          }
        }
      } catch (error) {
        console.error("Error validating stock:", error);
      }
    }
    
    setStockErrors(errors);
    return errors.length === 0;
  };

  const updateCart = (newCart) => {
    setCart(newCart);
    localStorage.setItem("ib_cart", JSON.stringify(newCart));
    validateCartStock(newCart);
  };

  const removeFromCart = (cartId) => {
    const newCart = cart.filter(item => item.cart_id !== cartId);
    updateCart(newCart);
  };

  const updateQuantity = async (cartId, newQty) => {
    if (newQty < 1) return;
    
    const item = cart.find(item => item.cart_id === cartId);
    if (!item) return;

    // Check stock before updating
    try {
      const response = await fetch(`http://localhost:5000/api/products/${item._id}`);
      if (response.ok) {
        const freshProduct = await response.json();
        if (newQty > freshProduct.quantity) {
          alert(`Only ${freshProduct.quantity} kg available for ${item.name}`);
          return;
        }
      }
    } catch (error) {
      console.error("Error checking stock:", error);
    }

    const newCart = cart.map(item => 
      item.cart_id === cartId ? { ...item, qty: newQty } : item
    );
    updateCart(newCart);
  };

  const getTotalPrice = () => {
    const total = cart.reduce((total, item) => {
      const price = Number(item.price) || 0;
      const quantity = Number(item.qty) || 0;
      return total + (price * quantity);
    }, 0);
    return total;
  };

  const getTotalItems = () => {
    const total = cart.reduce((total, item) => {
      const quantity = Number(item.qty) || 0;
      return total + quantity;
    }, 0);
    return total;
  };

  // Generate bill and create orders
  const generateBill = async () => {
    if (cart.length === 0) return;

    // Validate stock before proceeding
    const isValid = await validateCartStock(cart);
    if (!isValid) {
      alert("Some items in your cart exceed available stock. Please update quantities before proceeding.");
      return;
    }

    setLoading(true);
    try {
      // Get buyer info
      const currentUser = JSON.parse(localStorage.getItem("ib_user"));
      if (!currentUser || !currentUser.email) {
        alert("Please login to generate bill");
        navigate("/login");
        return;
      }

      const buyerEmail = currentUser.email;
      const buyerName = currentUser.name || "Customer";

      // Create orders for each item
      const orders = [];
      const failedOrders = [];

      for (const item of cart) {
        try {
          const orderData = {
            product_id: item._id,
            buyer_email: buyerEmail,
            buyer_name: buyerName,
            quantity: item.qty
          };

          const response = await fetch("http://localhost:5000/api/orders/", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(orderData)
          });

          if (response.ok) {
            const order = await response.json();
            orders.push({ 
              ...order, 
              product: item,
              status: 'success'
            });
          } else {
            const error = await response.json();
            failedOrders.push({
              product: item,
              error: error.error || "Failed to create order"
            });
          }
        } catch (error) {
          failedOrders.push({
            product: item,
            error: error.message
          });
        }
      }

      // Generate bill data
      const bill = {
        billId: `BILL-${Date.now()}`,
        date: new Date().toLocaleString(),
        buyer: {
          email: buyerEmail,
          name: buyerName
        },
        orders: orders,
        failedOrders: failedOrders,
        totalAmount: getTotalPrice(),
        totalItems: getTotalItems(),
        successCount: orders.length,
        failedCount: failedOrders.length
      };

      setBillData(bill);
      setShowBill(true);

      // Clear cart for successful orders only
      if (orders.length > 0) {
        // Remove only successful items from cart
        const successfulProductIds = orders.map(order => order.product._id);
        const newCart = cart.filter(item => !successfulProductIds.includes(item._id));
        updateCart(newCart);
      }

    } catch (error) {
      console.error("Error generating bill:", error);
      alert("Failed to generate bill. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const clearCart = () => {
    if (window.confirm("Are you sure you want to clear your cart?")) {
      updateCart([]);
    }
  };

  const printBill = () => {
    window.print();
  };

  const closeBill = () => {
    setShowBill(false);
    setBillData(null);
    if (cart.length === 0) {
      navigate("/products");
    }
  };

  if (cart.length === 0 && !showBill) {
    return (
      <div className="cart-page">
        <div className="cart-header">
          <button onClick={() => navigate("/products")} className="back-btn">
            <FaArrowLeft /> Continue Shopping
          </button>
          <h1>🛒 Shopping Cart</h1>
        </div>
        
        <div className="empty-cart-container">
          <div className="empty-cart">
            <div className="empty-cart-icon">
              <div className="cart-animation">
                <FaShoppingBag className="main-cart-icon" />
                <div className="floating-items">
                  <div className="floating-item">🍎</div>
                  <div className="floating-item">🥦</div>
                  <div className="floating-item">🍞</div>
                  <div className="floating-item">🥛</div>
                </div>
              </div>
            </div>
            <h2>Your cart feels lonely</h2>
            <p className="empty-cart-message">Add some fresh products to get started with your shopping!</p>
            <p className="empty-cart-subtitle">Discover amazing products from local farmers</p>
            
            <button onClick={() => navigate("/products")} className="explore-btn">
              <FaShoppingBag className="btn-icon" />
              Explore Fresh Products
            </button>

            <div className="empty-cart-features">
              <div className="feature-card">
                <div className="feature-icon">🚚</div>
                <h4>Free Delivery</h4>
                <p>On orders above ₹500</p>
              </div>
              <div className="feature-card">
                <div className="feature-icon">🌱</div>
                <h4>Farm Fresh</h4>
                <p>Direct from local farmers</p>
              </div>
              <div className="feature-card">
                <div className="feature-icon">💰</div>
                <h4>Best Prices</h4>
                <p>Competitive market rates</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (showBill && billData) {
    return (
      <div className="bill-page">
        <div className="bill-container">
          <div className="bill-header">
            <h1>{billData.successCount > 0 ? "🎫 Purchase Bill" : "❌ Order Failed"}</h1>
            <p className="bill-id">Bill ID: {billData.billId}</p>
            <p className="bill-date">{billData.date}</p>
          </div>

          <div className="bill-info">
            <div className="buyer-info">
              <h3>Customer Details</h3>
              <p><strong>Name:</strong> {billData.buyer.name}</p>
              <p><strong>Email:</strong> {billData.buyer.email}</p>
            </div>

            <div className="qr-section">
              <div className="qr-placeholder">
                <FaQrcode size={80} color="#666" />
                <p>Payment QR Code</p>
                <small>Scan to pay ₹{billData.totalAmount.toFixed(2)}</small>
              </div>
            </div>
          </div>

          {/* Success Orders */}
          {billData.orders.length > 0 && (
            <div className="bill-items">
              <h3>✅ Successful Orders ({billData.orders.length})</h3>
              <table>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Farmer</th>
                    <th>Price</th>
                    <th>Qty</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {billData.orders.map((order, index) => (
                    <tr key={index}>
                      <td>{order.product_name}</td>
                      <td>{order.product.farmer_name}</td>
                      <td>₹{order.product.price}</td>
                      <td>{order.quantity} kg</td>
                      <td>₹{order.total_price}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Failed Orders */}
          {billData.failedOrders.length > 0 && (
            <div className="failed-orders">
              <h3>❌ Failed Orders ({billData.failedOrders.length})</h3>
              <div className="failed-list">
                {billData.failedOrders.map((failed, index) => (
                  <div key={index} className="failed-item">
                    <span>{failed.product.name}</span>
                    <span className="error-message">{failed.error}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bill-summary">
            <div className="summary-row">
              <span>Total Items Ordered:</span>
              <span>{billData.totalItems}</span>
            </div>
            {billData.orders.length > 0 && (
              <div className="summary-row">
                <span>Successful Orders:</span>
                <span className="success">{billData.successCount}</span>
              </div>
            )}
            {billData.failedOrders.length > 0 && (
              <div className="summary-row">
                <span>Failed Orders:</span>
                <span className="error">{billData.failedCount}</span>
              </div>
            )}
            <div className="summary-row total">
              <span>Final Amount:</span>
              <span>₹{billData.totalAmount.toFixed(2)}</span>
            </div>
          </div>

          <div className="real-time-updates">
            <h4>🔄 Real-time Updates</h4>
            <div className="update-list">
              <p>✅ Farmer analytics updated automatically</p>
              <p>✅ Stock levels adjusted in real-time</p>
              <p>✅ Sales data recorded for farmers</p>
            </div>
          </div>

          <div className="bill-actions">
            <button onClick={printBill} className="print-btn">
              🖨️ Print Bill
            </button>
            <button onClick={closeBill} className="close-btn">
              {billData.failedOrders.length > 0 ? "🔄 Retry Failed Orders" : "✅ Continue Shopping"}
            </button>
          </div>

          <div className="bill-footer">
            <p>Thank you for your purchase! 🎉</p>
            {billData.failedOrders.length > 0 && (
              <p className="note warning">
                Some orders failed. Please check stock availability and try again.
              </p>
            )}
          </div>
        </div>

        <style>{`
          .bill-page {
            max-width: 800px;
            margin: 20px auto;
            padding: 20px;
            font-family: 'Poppins', sans-serif;
            background: white;
          }

          .bill-container {
            border: 2px solid #e2e8f0;
            border-radius: 15px;
            padding: 30px;
            background: white;
          }

          .bill-header {
            text-align: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 2px solid #e2e8f0;
          }

          .bill-header h1 {
            color: #059669;
            margin: 0 0 10px 0;
          }

          .bill-id, .bill-date {
            color: #64748b;
            font-weight: 600;
            margin: 5px 0;
          }

          .bill-info {
            display: grid;
            grid-template-columns: 1fr auto;
            gap: 30px;
            margin-bottom: 30px;
          }

          .buyer-info h3 {
            color: #1e293b;
            margin-bottom: 15px;
          }

          .buyer-info p {
            margin: 5px 0;
            color: #64748b;
          }

          .qr-section {
            text-align: center;
          }

          .qr-placeholder {
            padding: 20px;
            border: 2px dashed #cbd5e1;
            border-radius: 10px;
            background: #f8fafc;
          }

          .qr-placeholder p {
            margin-top: 10px;
            color: #64748b;
            font-weight: 600;
          }

          .qr-placeholder small {
            color: #94a3b8;
          }

          .bill-items, .failed-orders {
            margin-bottom: 30px;
          }

          .bill-items h3 {
            color: #059669;
            margin-bottom: 15px;
          }

          .failed-orders h3 {
            color: #dc2626;
            margin-bottom: 15px;
          }

          table {
            width: 100%;
            border-collapse: collapse;
          }

          th, td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #e2e8f0;
          }

          th {
            background: #f8fafc;
            color: #374151;
            font-weight: 600;
          }

          .failed-list {
            background: #fef2f2;
            border: 1px solid #fecaca;
            border-radius: 10px;
            padding: 15px;
          }

          .failed-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px;
            border-bottom: 1px solid #fecaca;
          }

          .failed-item:last-child {
            border-bottom: none;
            padding-bottom: 0;
          }

          .error-message {
            color: #dc2626;
            font-size: 14px;
            font-weight: 600;
          }

          .bill-summary {
            background: #f8fafc;
            padding: 20px;
            border-radius: 10px;
            margin-bottom: 20px;
          }

          .summary-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 10px;
            padding-bottom: 10px;
            border-bottom: 1px solid #e2e8f0;
          }

          .summary-row.total {
            border-bottom: none;
            font-size: 20px;
            font-weight: 700;
            color: #059669;
            padding-top: 15px;
            border-top: 2px solid #e2e8f0;
          }

          .success { color: #059669; font-weight: 600; }
          .error { color: #dc2626; font-weight: 600; }

          .real-time-updates {
            background: #f0f9ff;
            border: 1px solid #bae6fd;
            border-radius: 10px;
            padding: 15px;
            margin-bottom: 20px;
          }

          .real-time-updates h4 {
            color: #0369a1;
            margin: 0 0 10px 0;
          }

          .update-list p {
            margin: 5px 0;
            color: #0c4a6e;
            font-size: 14px;
          }

          .bill-actions {
            display: flex;
            gap: 15px;
            justify-content: center;
            margin-bottom: 20px;
          }

          .print-btn, .close-btn {
            padding: 12px 24px;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-weight: 600;
            transition: all 0.3s;
          }

          .print-btn {
            background: #3b82f6;
            color: white;
          }

          .close-btn {
            background: #059669;
            color: white;
          }

          .print-btn:hover {
            background: #2563eb;
            transform: scale(1.05);
          }

          .close-btn:hover {
            background: #047857;
            transform: scale(1.05);
          }

          .bill-footer {
            text-align: center;
            padding-top: 20px;
            border-top: 2px solid #e2e8f0;
          }

          .bill-footer p {
            margin: 5px 0;
            color: #64748b;
          }

          .note.warning {
            color: #dc2626;
            font-weight: 600;
          }

          @media print {
            .bill-actions { display: none; }
            .bill-page { margin: 0; padding: 0; }
          }

          @media (max-width: 768px) {
            .bill-info { grid-template-columns: 1fr; }
            .bill-actions { flex-direction: column; }
            .failed-item { flex-direction: column; align-items: flex-start; gap: 5px; }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="cart-page">
      <div className="cart-header">
        <button onClick={() => navigate("/products")} className="back-btn">
          <FaArrowLeft /> Continue Shopping
        </button>
        <h1>🛒 Shopping Cart ({getTotalItems()} items)</h1>
      </div>

      {/* Stock Warnings */}
      {stockErrors.length > 0 && (
        <div className="stock-warnings">
          <div className="warning-header">
            <FaExclamationTriangle color="#d97706" />
            <h3>Stock Issues Detected</h3>
          </div>
          {stockErrors.map((error, index) => (
            <div key={index} className="warning-item">
              <span>{error.productName}</span>
              <span className="stock-info">
                You have {error.requested} kg in cart, but only {error.available} kg available
              </span>
            </div>
          ))}
          <p className="warning-note">Please update quantities before checkout</p>
        </div>
      )}

      <div className="cart-content">
        <div className="cart-items">
          {cart.map(item => {
            const stockError = stockErrors.find(error => error.productId === item._id);
            const itemPrice = Number(item.price) || 0;
            const itemQuantity = Number(item.qty) || 0;
            const itemTotal = itemPrice * itemQuantity;
            
            return (
              <div key={item.cart_id} className={`cart-item ${stockError ? 'stock-error' : ''}`}>
                <img 
                  src={item.image} 
                  alt={item.name}
                  onError={(e) => {
                    e.target.src = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik01MCAzMEM0Mi4zODQgMzAgMzYgMzYuMzg0IDM2IDQ0QzM2IDUxLjYxNiA0Mi4zODQgNTggNTAgNThDNTcuNjE2IDU4IDY0IDUxLjYxNiA2NCA0NEM2NCAzNi4zODQgNTcuNjE2IDMwIDUwIDMwWk03NC4xODc1IDU4LjQzNzVIMjUuODEyNUMyNC44NjQ1IDU4LjQzNzUgMjQgNTkuMzAyIDI0IDYwLjI1VjYyLjgxMjVDMjQgNjMuNzYzNSAyNC44NjQ1IDY0LjYyNSAyNS44MTI1IDY0LjYyNUg3NC4xODc1Qzc1LjEzNTUgNjQuNjI1IDc2IDYzLjc2MzUgNzYgNjIuODEyNVY2MC4yNUM3NiA1OS4zMDIgNzUuMTM1NSA1OC40Mzc1IDc0LjE4NzUgNTguNDM3NVoiIGZpbGw9IiM5Q0EzQkYiLz4KPC9zdmc+";
                  }}
                />
                
                <div className="item-details">
                  <h3>{item.name}</h3>
                  <p className="price"><FaRupeeSign size={12} /> {itemPrice} / kg</p>
                  <p className="farmer">👨‍🌾 {item.farmer_name}</p>
                  {stockError && (
                    <p className="stock-warning">
                      ⚠️ Only {stockError.available} kg available
                    </p>
                  )}
                </div>

                <div className="quantity-controls">
                  <button 
                    onClick={() => updateQuantity(item.cart_id, itemQuantity - 1)}
                    disabled={itemQuantity <= 1}
                  >
                    <FaMinus />
                  </button>
                  <span>{itemQuantity} kg</span>
                  <button onClick={() => updateQuantity(item.cart_id, itemQuantity + 1)}>
                    <FaPlus />
                  </button>
                </div>

                <div className="item-total">
                  <FaRupeeSign size={14} /> {itemTotal.toFixed(2)}
                </div>

                <button 
                  onClick={() => removeFromCart(item.cart_id)}
                  className="remove-btn"
                >
                  <FaTrash />
                </button>
              </div>
            );
          })}
        </div>

        <div className="cart-summary">
          <h3>Order Summary</h3>
          <div className="summary-row">
            <span>Items ({getTotalItems()}):</span>
            <span><FaRupeeSign size={12} /> {getTotalPrice().toFixed(2)}</span>
          </div>
          <div className="summary-row">
            <span>Shipping:</span>
            <span>FREE</span>
          </div>
          <div className="summary-row total">
            <span>Final Amount:</span>
            <span><FaRupeeSign size={16} /> {getTotalPrice().toFixed(2)}</span>
          </div>

          <button 
            onClick={generateBill}
            disabled={loading || cart.length === 0 || stockErrors.length > 0}
            className="generate-bill-btn"
          >
            {loading ? (
              <>
                <div className="spinner"></div>
                Processing...
              </>
            ) : (
              <>
                <FaQrcode />
                Generate Bill & Pay
              </>
            )}
          </button>

          {stockErrors.length > 0 && (
            <div className="checkout-warning">
              <FaExclamationTriangle />
              Resolve stock issues to checkout
            </div>
          )}

          <button 
            onClick={clearCart}
            className="clear-cart-btn"
          >
            Clear Cart
          </button>

          <div className="purchase-info">
            <p><FaCheckCircle color="#059669" /> Bill generation creates orders automatically</p>
            <p><FaCheckCircle color="#059669" /> Farmer analytics updated in real-time</p>
            <p><FaCheckCircle color="#059669" /> Stock levels adjusted immediately</p>
          </div>
        </div>
      </div>

      <style>{`
        /* Empty Cart Styles */
        .cart-page {
          max-width: 1200px;
          margin: 0 auto;
          padding: 20px;
          font-family: 'Poppins', sans-serif;
          min-height: 80vh;
        }

        .cart-header {
          display: flex;
          align-items: center;
          gap: 20px;
          margin-bottom: 30px;
          padding-bottom: 20px;
          border-bottom: 2px solid #e2e8f0;
        }

        .back-btn {
          padding: 12px 24px;
          background: linear-gradient(135deg, #3b82f6, #1e40af);
          color: white;
          border: none;
          border-radius: 12px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: all 0.3s ease;
          font-weight: 600;
          box-shadow: 0 4px 15px rgba(59, 130, 246, 0.3);
        }

        .back-btn:hover {
          transform: translateX(-5px);
          box-shadow: 0 6px 20px rgba(59, 130, 246, 0.4);
        }

        .cart-header h1 {
          color: #1e293b;
          margin: 0;
          font-size: 2.5rem;
          font-weight: 700;
          background: linear-gradient(135deg, #1e293b, #374151);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        /* Empty Cart Container */
        .empty-cart-container {
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 60vh;
          padding: 40px 20px;
        }

        .empty-cart {
          text-align: center;
          background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
          padding: 60px 40px;
          border-radius: 24px;
          box-shadow: 
            0 20px 60px rgba(0, 0, 0, 0.1),
            0 8px 25px rgba(0, 0, 0, 0.05);
          border: 1px solid #e2e8f0;
          max-width: 600px;
          width: 100%;
          position: relative;
          overflow: hidden;
        }

        .empty-cart::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 4px;
          background: linear-gradient(90deg, #3b82f6, #10b981, #f59e0b);
          border-radius: 24px 24px 0 0;
        }

        /* Cart Animation */
        .empty-cart-icon {
          margin-bottom: 40px;
        }

        .cart-animation {
          position: relative;
          display: inline-block;
        }

        .main-cart-icon {
          font-size: 120px;
          color: #cbd5e1;
          animation: bounce 3s ease-in-out infinite;
        }

        .floating-items {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
        }

        .floating-item {
          position: absolute;
          font-size: 24px;
          animation: float 6s ease-in-out infinite;
        }

        .floating-item:nth-child(1) {
          top: 10%;
          left: 20%;
          animation-delay: 0s;
        }

        .floating-item:nth-child(2) {
          top: 20%;
          right: 15%;
          animation-delay: 1.5s;
        }

        .floating-item:nth-child(3) {
          bottom: 30%;
          left: 10%;
          animation-delay: 3s;
        }

        .floating-item:nth-child(4) {
          bottom: 15%;
          right: 25%;
          animation-delay: 4.5s;
        }

        /* Text Styling */
        .empty-cart h2 {
          font-size: 2.5rem;
          color: #1e293b;
          margin-bottom: 16px;
          font-weight: 700;
          background: linear-gradient(135deg, #1e293b, #374151);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .empty-cart-message {
          font-size: 1.3rem;
          color: #64748b;
          margin-bottom: 8px;
          line-height: 1.6;
          font-weight: 500;
        }

        .empty-cart-subtitle {
          font-size: 1.1rem;
          color: #94a3b8;
          margin-bottom: 40px;
          line-height: 1.5;
        }

        /* Explore Button */
        .explore-btn {
          padding: 18px 40px;
          background: linear-gradient(135deg, #10b981, #059669);
          color: white;
          border: none;
          border-radius: 16px;
          cursor: pointer;
          font-weight: 600;
          font-size: 1.2rem;
          transition: all 0.3s ease;
          box-shadow: 0 8px 25px rgba(16, 185, 129, 0.3);
          display: flex;
          align-items: center;
          gap: 12px;
          margin: 0 auto 50px auto;
          position: relative;
          overflow: hidden;
        }

        .explore-btn::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
          transition: left 0.5s;
        }

        .explore-btn:hover::before {
          left: 100%;
        }

        .explore-btn:hover {
          transform: translateY(-3px);
          box-shadow: 0 12px 35px rgba(16, 185, 129, 0.4);
          background: linear-gradient(135deg, #059669, #047857);
        }

        .btn-icon {
          font-size: 1.1rem;
        }

        /* Features Grid */
        .empty-cart-features {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 20px;
          margin-top: 40px;
        }

        .feature-card {
          background: white;
          padding: 25px 20px;
          border-radius: 16px;
          text-align: center;
          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.05);
          border: 1px solid #f1f5f9;
          transition: all 0.3s ease;
          position: relative;
          overflow: hidden;
        }

        .feature-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 3px;
          background: linear-gradient(90deg, #3b82f6, #8b5cf6);
          transform: scaleX(0);
          transition: transform 0.3s ease;
        }

        .feature-card:hover::before {
          transform: scaleX(1);
        }

        .feature-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
        }

        .feature-icon {
          font-size: 2.5rem;
          margin-bottom: 12px;
          display: block;
        }

        .feature-card h4 {
          color: #1e293b;
          margin-bottom: 8px;
          font-weight: 600;
          font-size: 1.1rem;
        }

        .feature-card p {
          color: #64748b;
          font-size: 0.9rem;
          line-height: 1.4;
          margin: 0;
        }

        /* Animations */
        @keyframes bounce {
          0%, 100% {
            transform: translateY(0) scale(1);
          }
          25% {
            transform: translateY(-10px) scale(1.05);
          }
          50% {
            transform: translateY(0) scale(1);
          }
          75% {
            transform: translateY(-5px) scale(1.02);
          }
        }

        @keyframes float {
          0%, 100% {
            transform: translateY(0) rotate(0deg);
          }
          33% {
            transform: translateY(-20px) rotate(120deg);
          }
          66% {
            transform: translateY(10px) rotate(240deg);
          }
        }

        /* Cart with Items Styles */
        .stock-warnings {
          background: #fffbeb;
          border: 2px solid #f59e0b;
          border-radius: 10px;
          padding: 20px;
          margin-bottom: 25px;
        }

        .warning-header {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 15px;
        }

        .warning-header h3 {
          margin: 0;
          color: #92400e;
        }

        .warning-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 0;
          border-bottom: 1px solid #fed7aa;
        }

        .warning-item:last-child {
          border-bottom: none;
          padding-bottom: 0;
        }

        .stock-info {
          color: #dc2626;
          font-weight: 600;
          font-size: 14px;
        }

        .warning-note {
          margin: 10px 0 0 0;
          color: #92400e;
          font-size: 14px;
          text-align: center;
        }

        .cart-content {
          display: grid;
          grid-template-columns: 1fr 400px;
          gap: 40px;
        }

        .cart-items {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .cart-item {
          display: grid;
          grid-template-columns: 100px 1fr auto auto auto;
          gap: 20px;
          align-items: center;
          padding: 20px;
          background: white;
          border-radius: 15px;
          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
          transition: all 0.3s;
          border: 2px solid #f1f5f9;
        }

        .cart-item.stock-error {
          border-color: #fecaca;
          background: #fef2f2;
        }

        .cart-item:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
          border-color: #dbeafe;
        }

        .cart-item.stock-error:hover {
          border-color: #fca5a5;
        }

        .cart-item img {
          width: 100px;
          height: 100px;
          object-fit: cover;
          border-radius: 10px;
        }

        .item-details h3 {
          margin: 0 0 8px 0;
          color: #1e293b;
        }

        .price {
          color: #2563eb;
          font-weight: 600;
          margin: 0 0 5px 0;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .farmer {
          color: #64748b;
          font-size: 14px;
          margin: 0 0 5px 0;
        }

        .stock-warning {
          color: #dc2626;
          font-size: 12px;
          font-weight: 600;
          margin: 0;
        }

        .quantity-controls {
          display: flex;
          align-items: center;
          gap: 15px;
          background: #f8fafc;
          padding: 8px 16px;
          border-radius: 10px;
        }

        .quantity-controls button {
          background: none;
          border: none;
          cursor: pointer;
          padding: 5px;
          border-radius: 5px;
          transition: all 0.3s;
        }

        .quantity-controls button:hover:not(:disabled) {
          background: #e2e8f0;
        }

        .quantity-controls button:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .quantity-controls span {
          font-weight: 600;
          min-width: 30px;
          text-align: center;
        }

        .item-total {
          font-size: 16px;
          font-weight: 700;
          color: #059669;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .remove-btn {
          background: #fef2f2;
          border: none;
          padding: 10px;
          border-radius: 8px;
          cursor: pointer;
          color: #dc2626;
          transition: all 0.3s;
        }

        .remove-btn:hover {
          background: #fecaca;
          transform: scale(1.1);
        }

        .cart-summary {
          background: white;
          padding: 30px;
          border-radius: 20px;
          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
          height: fit-content;
          position: sticky;
          top: 20px;
          border: 2px solid #f1f5f9;
        }

        .cart-summary h3 {
          margin: 0 0 25px 0;
          color: #1e293b;
          text-align: center;
          font-size: 22px;
          padding-bottom: 15px;
          border-bottom: 2px solid #e2e8f0;
        }

        .summary-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 15px;
          padding-bottom: 15px;
          border-bottom: 1px solid #f1f5f9;
        }

        .summary-row.total {
          border-bottom: none;
          font-size: 20px;
          font-weight: 700;
          color: #059669;
          padding-top: 15px;
          border-top: 2px solid #e2e8f0;
        }

        .generate-bill-btn {
          width: 100%;
          padding: 16px;
          background: linear-gradient(135deg, #059669, #047857);
          color: white;
          border: none;
          border-radius: 12px;
          font-size: 18px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s;
          margin-bottom: 15px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
        }

        .generate-bill-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(5, 150, 105, 0.3);
        }

        .generate-bill-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
        }

        .checkout-warning {
          background: #fef3c7;
          color: #92400e;
          padding: 12px;
          border-radius: 8px;
          text-align: center;
          font-weight: 600;
          margin-bottom: 15px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          border: 1px solid #f59e0b;
        }

        .spinner {
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-radius: 50%;
          border-top: 2px solid white;
          width: 20px;
          height: 20px;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .clear-cart-btn {
          width: 100%;
          padding: 12px;
          background: #f3f4f6;
          color: #6b7280;
          border: none;
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.3s;
          margin-bottom: 20px;
        }

        .clear-cart-btn:hover {
          background: #e5e7eb;
        }

        .purchase-info {
          background: #f0fdf4;
          padding: 15px;
          border-radius: 10px;
          border: 1px solid #bbf7d0;
        }

        .purchase-info p {
          margin: 8px 0;
          font-size: 12px;
          color: #059669;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        /* Responsive Design */
        @media (max-width: 768px) {
          .cart-header {
            flex-direction: column;
            gap: 15px;
            text-align: center;
          }

          .cart-header h1 {
            font-size: 2rem;
          }

          .empty-cart {
            padding: 40px 20px;
            margin: 20px;
          }

          .empty-cart h2 {
            font-size: 2rem;
          }

          .empty-cart-message {
            font-size: 1.1rem;
          }

          .empty-cart-subtitle {
            font-size: 1rem;
          }

          .explore-btn {
            padding: 16px 32px;
            font-size: 1.1rem;
          }

          .main-cart-icon {
            font-size: 80px;
          }

          .empty-cart-features {
            grid-template-columns: 1fr;
            gap: 15px;
          }

          .feature-card {
            padding: 20px 15px;
          }

          .cart-content {
            grid-template-columns: 1fr;
          }

          .cart-item {
            grid-template-columns: 80px 1fr;
            gap: 15px;
          }

          .quantity-controls, .item-total, .remove-btn {
            grid-column: 1 / -1;
            justify-self: start;
          }

          .cart-item img {
            width: 80px;
            height: 80px;
            grid-row: 1 / 3;
          }

          .cart-summary {
            position: static;
          }

          .warning-item {
            flex-direction: column;
            align-items: flex-start;
            gap: 5px;
          }
        }

        @media (max-width: 480px) {
          .cart-page {
            padding: 15px;
          }

          .empty-cart {
            padding: 30px 15px;
          }

          .empty-cart h2 {
            font-size: 1.8rem;
          }

          .explore-btn {
            padding: 14px 28px;
            font-size: 1rem;
          }
        }
      `}</style>
    </div>
  );
}