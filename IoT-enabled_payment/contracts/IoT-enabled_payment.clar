;; IoT Payment Solutions Smart Contract
;; Simplified version for smart device payments

;; Constants
(define-constant contract-owner tx-sender)
(define-constant err-unauthorized (err u100))
(define-constant err-insufficient-balance (err u101))
(define-constant err-device-not-found (err u102))

;; Data structures
(define-map devices 
  { device-id: (string-ascii 64) }
  { 
    owner: principal,
    balance: uint,
    rate-per-use: uint,
    active: bool
  }
)

(define-map payments
  { payment-id: uint }
  {
    device-id: (string-ascii 64),
    amount: uint,
    timestamp: uint,
    user: principal
  }
)

(define-data-var payment-counter uint u0)

;; Register IoT device
(define-public (register-device (device-id (string-ascii 64)) (rate-per-use uint))
  (begin
    (map-set devices 
      { device-id: device-id }
      {
        owner: tx-sender,
        balance: u0,
        rate-per-use: rate-per-use,
        active: true
      }
    )
    (ok device-id)
  )
)

;; Make payment for device usage
(define-public (pay-for-usage (device-id (string-ascii 64)) (amount uint))
  (let (
    (device (unwrap! (map-get? devices { device-id: device-id }) err-device-not-found))
    (payment-id (+ (var-get payment-counter) u1))
  )
    (asserts! (>= amount (get rate-per-use device)) err-insufficient-balance)
    (try! (stx-transfer? amount tx-sender contract-owner))
    
    ;; Update device balance
    (map-set devices 
      { device-id: device-id }
      (merge device { balance: (+ (get balance device) amount) })
    )
    
    ;; Record payment with stacks-block-height
    (map-set payments
      { payment-id: payment-id }
      {
        device-id: device-id,
        amount: amount,
        timestamp: stacks-block-height,
        user: tx-sender
      }
    )
    
    (var-set payment-counter payment-id)
    (ok payment-id)
  )
)

;; Withdraw device earnings (device owner only)
(define-public (withdraw-earnings (device-id (string-ascii 64)))
  (let (
    (device (unwrap! (map-get? devices { device-id: device-id }) err-device-not-found))
    (balance (get balance device))
  )
    (asserts! (is-eq tx-sender (get owner device)) err-unauthorized)
    (asserts! (> balance u0) err-insufficient-balance)
    
    (try! (as-contract (stx-transfer? balance tx-sender (get owner device))))
    
    (map-set devices 
      { device-id: device-id }
      (merge device { balance: u0 })
    )
    
    (ok balance)
  )
)

;; Read-only functions
(define-read-only (get-device-info (device-id (string-ascii 64)))
  (map-get? devices { device-id: device-id })
)

(define-read-only (get-payment-info (payment-id uint))
  (map-get? payments { payment-id: payment-id })
)

(define-read-only (get-device-balance (device-id (string-ascii 64)))
  (match (map-get? devices { device-id: device-id })
    device (ok (get balance device))
    err-device-not-found
  )
)