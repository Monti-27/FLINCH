export type FlinchV2 = {
  "address": "JDQgyFxwZJUpA31y2qhqhGgwfm5k7zANYUY1ctkqPB9y",
  "metadata": {
    "name": "flinchV2",
    "version": "0.2.0",
    "spec": "0.1.0"
  },
  "instructions": [
    {
      "name": "cancelRoom",
      "discriminator": [
        91,
        107,
        215,
        178,
        200,
        224,
        241,
        237
      ],
      "accounts": [
        {
          "name": "caller",
          "signer": true
        },
        {
          "name": "ledger",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  101,
                  100,
                  103,
                  101,
                  114,
                  45,
                  118,
                  50
                ]
              },
              {
                "kind": "account",
                "path": "ledger.host",
                "account": "roomLedger"
              },
              {
                "kind": "account",
                "path": "ledger.nonce",
                "account": "roomLedger"
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "claimUsdc",
      "discriminator": [
        43,
        131,
        9,
        102,
        229,
        140,
        91,
        141
      ],
      "accounts": [
        {
          "name": "player",
          "signer": true
        },
        {
          "name": "ledger",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  101,
                  100,
                  103,
                  101,
                  114,
                  45,
                  118,
                  50
                ]
              },
              {
                "kind": "account",
                "path": "ledger.host",
                "account": "roomLedger"
              },
              {
                "kind": "account",
                "path": "ledger.nonce",
                "account": "roomLedger"
              }
            ]
          }
        },
        {
          "name": "mint"
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "ledger"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "destination",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "player"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    },
    {
      "name": "claimWsol",
      "discriminator": [
        67,
        232,
        159,
        94,
        52,
        252,
        63,
        89
      ],
      "accounts": [
        {
          "name": "player",
          "signer": true
        },
        {
          "name": "ledger",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  101,
                  100,
                  103,
                  101,
                  114,
                  45,
                  118,
                  50
                ]
              },
              {
                "kind": "account",
                "path": "ledger.host",
                "account": "roomLedger"
              },
              {
                "kind": "account",
                "path": "ledger.nonce",
                "account": "roomLedger"
              }
            ]
          }
        },
        {
          "name": "mint"
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "ledger"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "destination",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "player"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    },
    {
      "name": "delegateControl",
      "discriminator": [
        229,
        33,
        220,
        233,
        130,
        77,
        101,
        155
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "ledger",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  101,
                  100,
                  103,
                  101,
                  114,
                  45,
                  118,
                  50
                ]
              },
              {
                "kind": "account",
                "path": "ledger.host",
                "account": "roomLedger"
              },
              {
                "kind": "account",
                "path": "ledger.nonce",
                "account": "roomLedger"
              }
            ]
          }
        },
        {
          "name": "bufferControl",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  117,
                  102,
                  102,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "control"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                255,
                196,
                110,
                207,
                63,
                210,
                39,
                245,
                124,
                139,
                157,
                233,
                219,
                223,
                21,
                254,
                68,
                214,
                152,
                48,
                126,
                176,
                60,
                192,
                233,
                197,
                140,
                186,
                13,
                125,
                130,
                0
              ]
            }
          }
        },
        {
          "name": "delegationRecordControl",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  108,
                  101,
                  103,
                  97,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "control"
              }
            ],
            "program": {
              "kind": "account",
              "path": "delegationProgram"
            }
          }
        },
        {
          "name": "delegationMetadataControl",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  108,
                  101,
                  103,
                  97,
                  116,
                  105,
                  111,
                  110,
                  45,
                  109,
                  101,
                  116,
                  97,
                  100,
                  97,
                  116,
                  97
                ]
              },
              {
                "kind": "account",
                "path": "control"
              }
            ],
            "program": {
              "kind": "account",
              "path": "delegationProgram"
            }
          }
        },
        {
          "name": "control",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  116,
                  114,
                  111,
                  108,
                  45,
                  118,
                  50
                ]
              },
              {
                "kind": "account",
                "path": "ledger"
              }
            ]
          }
        },
        {
          "name": "ownerProgram",
          "address": "JDQgyFxwZJUpA31y2qhqhGgwfm5k7zANYUY1ctkqPB9y"
        },
        {
          "name": "delegationProgram",
          "address": "DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "executeBatch",
      "discriminator": [
        112,
        159,
        211,
        51,
        238,
        70,
        212,
        60
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "ledger",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  101,
                  100,
                  103,
                  101,
                  114,
                  45,
                  118,
                  50
                ]
              },
              {
                "kind": "account",
                "path": "ledger.host",
                "account": "roomLedger"
              },
              {
                "kind": "account",
                "path": "ledger.nonce",
                "account": "roomLedger"
              }
            ]
          }
        },
        {
          "name": "control",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  116,
                  114,
                  111,
                  108,
                  45,
                  118,
                  50
                ]
              },
              {
                "kind": "account",
                "path": "ledger"
              }
            ]
          }
        },
        {
          "name": "receipt",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  101,
                  99,
                  101,
                  105,
                  112,
                  116,
                  45,
                  118,
                  50
                ]
              },
              {
                "kind": "account",
                "path": "ledger"
              },
              {
                "kind": "account",
                "path": "control.revision",
                "account": "roomControl"
              }
            ]
          }
        },
        {
          "name": "wsolMint",
          "address": "So11111111111111111111111111111111111111112"
        },
        {
          "name": "usdcMint",
          "address": "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"
        },
        {
          "name": "wsolVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "ledger"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "wsolMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "usdcVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "ledger"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "usdcMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "pool",
          "writable": true
        },
        {
          "name": "ammConfig"
        },
        {
          "name": "authority",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  97,
                  110,
                  100,
                  95,
                  108,
                  112,
                  95,
                  109,
                  105,
                  110,
                  116,
                  95,
                  97,
                  117,
                  116,
                  104,
                  95,
                  115,
                  101,
                  101,
                  100
                ]
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                184,
                152,
                153,
                121,
                45,
                202,
                82,
                52,
                121,
                111,
                231,
                116,
                98,
                176,
                49,
                223,
                70,
                63,
                95,
                254,
                174,
                54,
                124,
                92,
                15,
                251,
                36,
                110,
                28,
                183,
                206,
                12
              ]
            }
          }
        },
        {
          "name": "poolWsolVault",
          "writable": true
        },
        {
          "name": "poolUsdcVault",
          "writable": true
        },
        {
          "name": "observation",
          "writable": true
        },
        {
          "name": "raydiumProgram",
          "address": "DRaycpLY18LhpbydsBWbVJtxpNv9oXPgjRSfpF2bWpYb"
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "expireBatch",
      "discriminator": [
        55,
        115,
        118,
        37,
        188,
        219,
        144,
        105
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "ledger",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  101,
                  100,
                  103,
                  101,
                  114,
                  45,
                  118,
                  50
                ]
              },
              {
                "kind": "account",
                "path": "ledger.host",
                "account": "roomLedger"
              },
              {
                "kind": "account",
                "path": "ledger.nonce",
                "account": "roomLedger"
              }
            ]
          }
        },
        {
          "name": "control",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  116,
                  114,
                  111,
                  108,
                  45,
                  118,
                  50
                ]
              },
              {
                "kind": "account",
                "path": "ledger"
              }
            ]
          }
        },
        {
          "name": "receipt",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  101,
                  99,
                  101,
                  105,
                  112,
                  116,
                  45,
                  118,
                  50
                ]
              },
              {
                "kind": "account",
                "path": "ledger"
              },
              {
                "kind": "account",
                "path": "control.revision",
                "account": "roomControl"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "freezeBatch",
      "discriminator": [
        176,
        184,
        96,
        95,
        38,
        136,
        33,
        35
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "control",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  116,
                  114,
                  111,
                  108,
                  45,
                  118,
                  50
                ]
              },
              {
                "kind": "account",
                "path": "control.ledger",
                "account": "roomControl"
              }
            ]
          }
        },
        {
          "name": "magicProgram",
          "address": "Magic11111111111111111111111111111111111111"
        },
        {
          "name": "magicContext",
          "writable": true,
          "address": "MagicContext1111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "initializeRoom",
      "discriminator": [
        216,
        42,
        137,
        161,
        61,
        72,
        154,
        238
      ],
      "accounts": [
        {
          "name": "host",
          "writable": true,
          "signer": true
        },
        {
          "name": "ledger",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  101,
                  100,
                  103,
                  101,
                  114,
                  45,
                  118,
                  50
                ]
              },
              {
                "kind": "account",
                "path": "host"
              },
              {
                "kind": "arg",
                "path": "args.nonce"
              }
            ]
          }
        },
        {
          "name": "pool"
        },
        {
          "name": "wsolMint",
          "address": "So11111111111111111111111111111111111111112"
        },
        {
          "name": "usdcMint",
          "address": "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"
        },
        {
          "name": "wsolVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "ledger"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "wsolMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "usdcVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "ledger"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "usdcMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "args",
          "type": {
            "defined": {
              "name": "initializeArgs"
            }
          }
        }
      ]
    },
    {
      "name": "joinRoom",
      "discriminator": [
        95,
        232,
        188,
        81,
        124,
        130,
        78,
        139
      ],
      "accounts": [
        {
          "name": "player",
          "signer": true
        },
        {
          "name": "ledger",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  101,
                  100,
                  103,
                  101,
                  114,
                  45,
                  118,
                  50
                ]
              },
              {
                "kind": "account",
                "path": "ledger.host",
                "account": "roomLedger"
              },
              {
                "kind": "account",
                "path": "ledger.nonce",
                "account": "roomLedger"
              }
            ]
          }
        },
        {
          "name": "mint",
          "address": "So11111111111111111111111111111111111111112"
        },
        {
          "name": "source",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "player"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "ledger"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    },
    {
      "name": "processUndelegation",
      "discriminator": [
        196,
        28,
        41,
        206,
        48,
        37,
        51,
        167
      ],
      "accounts": [
        {
          "name": "baseAccount",
          "writable": true
        },
        {
          "name": "buffer",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  117,
                  110,
                  100,
                  101,
                  108,
                  101,
                  103,
                  97,
                  116,
                  101,
                  45,
                  98,
                  117,
                  102,
                  102,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "baseAccount"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                181,
                183,
                0,
                225,
                242,
                87,
                58,
                192,
                204,
                6,
                34,
                1,
                52,
                74,
                207,
                151,
                184,
                53,
                6,
                235,
                140,
                229,
                25,
                152,
                204,
                98,
                126,
                24,
                147,
                128,
                167,
                62
              ]
            }
          }
        },
        {
          "name": "payer",
          "writable": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "accountSeeds",
          "type": {
            "vec": "bytes"
          }
        }
      ]
    },
    {
      "name": "queueSell",
      "discriminator": [
        96,
        86,
        203,
        116,
        32,
        31,
        102,
        37
      ],
      "accounts": [
        {
          "name": "signer",
          "signer": true
        },
        {
          "name": "control",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  116,
                  114,
                  111,
                  108,
                  45,
                  118,
                  50
                ]
              },
              {
                "kind": "account",
                "path": "control.ledger",
                "account": "roomControl"
              }
            ]
          }
        },
        {
          "name": "sessionToken",
          "optional": true
        }
      ],
      "args": [
        {
          "name": "seat",
          "type": "u8"
        },
        {
          "name": "nonce",
          "type": "u64"
        },
        {
          "name": "minimumOutput",
          "type": "u64"
        }
      ]
    },
    {
      "name": "recoverRound",
      "discriminator": [
        87,
        173,
        77,
        57,
        40,
        45,
        2,
        160
      ],
      "accounts": [
        {
          "name": "ledger",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  101,
                  100,
                  103,
                  101,
                  114,
                  45,
                  118,
                  50
                ]
              },
              {
                "kind": "account",
                "path": "ledger.host",
                "account": "roomLedger"
              },
              {
                "kind": "account",
                "path": "ledger.nonce",
                "account": "roomLedger"
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "setSessionSigner",
      "discriminator": [
        174,
        162,
        190,
        10,
        162,
        118,
        111,
        231
      ],
      "accounts": [
        {
          "name": "player",
          "signer": true
        },
        {
          "name": "ledger",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  101,
                  100,
                  103,
                  101,
                  114,
                  45,
                  118,
                  50
                ]
              },
              {
                "kind": "account",
                "path": "ledger.host",
                "account": "roomLedger"
              },
              {
                "kind": "account",
                "path": "ledger.nonce",
                "account": "roomLedger"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "signer",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "startRound",
      "discriminator": [
        144,
        144,
        43,
        7,
        193,
        42,
        217,
        215
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "ledger",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  101,
                  100,
                  103,
                  101,
                  114,
                  45,
                  118,
                  50
                ]
              },
              {
                "kind": "account",
                "path": "ledger.host",
                "account": "roomLedger"
              },
              {
                "kind": "account",
                "path": "ledger.nonce",
                "account": "roomLedger"
              }
            ]
          }
        },
        {
          "name": "control",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  116,
                  114,
                  111,
                  108,
                  45,
                  118,
                  50
                ]
              },
              {
                "kind": "account",
                "path": "ledger"
              }
            ]
          }
        },
        {
          "name": "mint",
          "address": "So11111111111111111111111111111111111111112"
        },
        {
          "name": "vault",
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "ledger"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    }
  ],
  "accounts": [
    {
      "name": "batchReceipt",
      "discriminator": [
        121,
        10,
        11,
        19,
        248,
        174,
        122,
        64
      ]
    },
    {
      "name": "roomControl",
      "discriminator": [
        30,
        240,
        72,
        57,
        200,
        111,
        195,
        175
      ]
    },
    {
      "name": "roomLedger",
      "discriminator": [
        84,
        243,
        108,
        88,
        15,
        254,
        214,
        176
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "invalidConfiguration"
    },
    {
      "code": 6001,
      "name": "wrongPhase"
    },
    {
      "code": 6002,
      "name": "fundingExpired"
    },
    {
      "code": 6003,
      "name": "unauthorized"
    },
    {
      "code": 6004,
      "name": "duplicateWallet"
    },
    {
      "code": 6005,
      "name": "roomFull"
    },
    {
      "code": 6006,
      "name": "roomNotFull"
    },
    {
      "code": 6007,
      "name": "invalidState"
    },
    {
      "code": 6008,
      "name": "nothingToClaim"
    },
    {
      "code": 6009,
      "name": "invalidMint"
    },
    {
      "code": 6010,
      "name": "invalidPool"
    },
    {
      "code": 6011,
      "name": "invalidVault"
    },
    {
      "code": 6012,
      "name": "transferMismatch"
    },
    {
      "code": 6013,
      "name": "insufficientCustody"
    },
    {
      "code": 6014,
      "name": "domainRejected"
    },
    {
      "code": 6015,
      "name": "invalidControl"
    }
  ],
  "types": [
    {
      "name": "ammConfig",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "disableCreatePool",
            "type": "bool"
          },
          {
            "name": "index",
            "type": "u16"
          },
          {
            "name": "tradeFeeRate",
            "type": "u64"
          },
          {
            "name": "protocolFeeRate",
            "type": "u64"
          },
          {
            "name": "fundFeeRate",
            "type": "u64"
          },
          {
            "name": "createPoolFee",
            "type": "u64"
          },
          {
            "name": "protocolOwner",
            "type": "pubkey"
          },
          {
            "name": "fundOwner",
            "type": "pubkey"
          },
          {
            "name": "creatorFeeRate",
            "type": "u64"
          },
          {
            "name": "padding",
            "type": {
              "array": [
                "u64",
                15
              ]
            }
          }
        ]
      }
    },
    {
      "name": "batchReceipt",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "version",
            "type": "u8"
          },
          {
            "name": "ledger",
            "type": "pubkey"
          },
          {
            "name": "revision",
            "type": "u64"
          },
          {
            "name": "sellers",
            "type": "u8"
          },
          {
            "name": "cohortIndex",
            "type": "u32"
          },
          {
            "name": "expired",
            "type": "bool"
          },
          {
            "name": "executedAt",
            "type": "i64"
          },
          {
            "name": "input",
            "type": "u64"
          },
          {
            "name": "output",
            "type": "u64"
          },
          {
            "name": "allocations",
            "type": {
              "array": [
                "u64",
                4
              ]
            }
          }
        ]
      }
    },
    {
      "name": "controlPhase",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "prepared"
          },
          {
            "name": "live"
          },
          {
            "name": "frozen"
          },
          {
            "name": "resolved"
          }
        ]
      }
    },
    {
      "name": "economicState",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "startedAt",
            "type": "i64"
          },
          {
            "name": "revision",
            "type": "u64"
          },
          {
            "name": "nextCohort",
            "type": "u32"
          },
          {
            "name": "holdings",
            "type": {
              "array": [
                "u64",
                4
              ]
            }
          },
          {
            "name": "usdcClaims",
            "type": {
              "array": [
                "u64",
                4
              ]
            }
          },
          {
            "name": "initialWsol",
            "type": "u64"
          },
          {
            "name": "swappedWsol",
            "type": "u64"
          },
          {
            "name": "claimedWsol",
            "type": "u64"
          },
          {
            "name": "receivedUsdc",
            "type": "u64"
          },
          {
            "name": "claimedUsdc",
            "type": "u64"
          },
          {
            "name": "terminalTag",
            "type": "u8"
          },
          {
            "name": "terminalSeat",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "initializeArgs",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "nonce",
            "type": "u64"
          },
          {
            "name": "stake",
            "type": "u64"
          },
          {
            "name": "validator",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "observation",
      "serialization": "bytemuckunsafe",
      "repr": {
        "kind": "c",
        "packed": true
      },
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "blockTimestamp",
            "type": "u64"
          },
          {
            "name": "cumulativeToken0PriceX32",
            "type": "u128"
          },
          {
            "name": "cumulativeToken1PriceX32",
            "type": "u128"
          }
        ]
      }
    },
    {
      "name": "observationState",
      "serialization": "bytemuckunsafe",
      "repr": {
        "kind": "c",
        "packed": true
      },
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "initialized",
            "type": "bool"
          },
          {
            "name": "observationIndex",
            "type": "u16"
          },
          {
            "name": "poolId",
            "type": "pubkey"
          },
          {
            "name": "observations",
            "type": {
              "array": [
                {
                  "defined": {
                    "name": "observation"
                  }
                },
                100
              ]
            }
          },
          {
            "name": "lastUpdateTimestamp",
            "type": "u64"
          },
          {
            "name": "padding",
            "type": {
              "array": [
                "u64",
                3
              ]
            }
          }
        ]
      }
    },
    {
      "name": "poolState",
      "serialization": "bytemuckunsafe",
      "repr": {
        "kind": "c",
        "packed": true
      },
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "ammConfig",
            "type": "pubkey"
          },
          {
            "name": "poolCreator",
            "type": "pubkey"
          },
          {
            "name": "token0Vault",
            "type": "pubkey"
          },
          {
            "name": "token1Vault",
            "type": "pubkey"
          },
          {
            "name": "lpMint",
            "type": "pubkey"
          },
          {
            "name": "token0Mint",
            "type": "pubkey"
          },
          {
            "name": "token1Mint",
            "type": "pubkey"
          },
          {
            "name": "token0Program",
            "type": "pubkey"
          },
          {
            "name": "token1Program",
            "type": "pubkey"
          },
          {
            "name": "observationKey",
            "type": "pubkey"
          },
          {
            "name": "authBump",
            "type": "u8"
          },
          {
            "name": "status",
            "type": "u8"
          },
          {
            "name": "lpMintDecimals",
            "type": "u8"
          },
          {
            "name": "mint0Decimals",
            "type": "u8"
          },
          {
            "name": "mint1Decimals",
            "type": "u8"
          },
          {
            "name": "lpSupply",
            "type": "u64"
          },
          {
            "name": "protocolFeesToken0",
            "type": "u64"
          },
          {
            "name": "protocolFeesToken1",
            "type": "u64"
          },
          {
            "name": "fundFeesToken0",
            "type": "u64"
          },
          {
            "name": "fundFeesToken1",
            "type": "u64"
          },
          {
            "name": "openTime",
            "type": "u64"
          },
          {
            "name": "recentEpoch",
            "type": "u64"
          },
          {
            "name": "creatorFeeOn",
            "type": "u8"
          },
          {
            "name": "enableCreatorFee",
            "type": "bool"
          },
          {
            "name": "padding1",
            "type": {
              "array": [
                "u8",
                6
              ]
            }
          },
          {
            "name": "creatorFeesToken0",
            "type": "u64"
          },
          {
            "name": "creatorFeesToken1",
            "type": "u64"
          },
          {
            "name": "padding",
            "type": {
              "array": [
                "u64",
                28
              ]
            }
          }
        ]
      }
    },
    {
      "name": "roomControl",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "version",
            "type": "u8"
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "ledger",
            "type": "pubkey"
          },
          {
            "name": "validator",
            "type": "pubkey"
          },
          {
            "name": "wallets",
            "type": {
              "array": [
                "pubkey",
                4
              ]
            }
          },
          {
            "name": "sessionSigners",
            "type": {
              "array": [
                "pubkey",
                4
              ]
            }
          },
          {
            "name": "startedAt",
            "type": "i64"
          },
          {
            "name": "revision",
            "type": "u64"
          },
          {
            "name": "nextCohort",
            "type": "u32"
          },
          {
            "name": "holdings",
            "type": {
              "array": [
                "u64",
                4
              ]
            }
          },
          {
            "name": "phase",
            "type": {
              "defined": {
                "name": "controlPhase"
              }
            }
          },
          {
            "name": "attempts",
            "type": {
              "array": [
                "u8",
                4
              ]
            }
          },
          {
            "name": "nonces",
            "type": {
              "array": [
                "u64",
                4
              ]
            }
          },
          {
            "name": "sellers",
            "type": "u8"
          },
          {
            "name": "cohortIndex",
            "type": "u32"
          },
          {
            "name": "minimumOutputs",
            "type": {
              "array": [
                "u64",
                4
              ]
            }
          }
        ]
      }
    },
    {
      "name": "roomLedger",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "version",
            "type": "u8"
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "host",
            "type": "pubkey"
          },
          {
            "name": "nonce",
            "type": "u64"
          },
          {
            "name": "validator",
            "type": "pubkey"
          },
          {
            "name": "pool",
            "type": "pubkey"
          },
          {
            "name": "stake",
            "type": "u64"
          },
          {
            "name": "fundingDeadline",
            "type": "i64"
          },
          {
            "name": "phase",
            "type": {
              "defined": {
                "name": "roomPhase"
              }
            }
          },
          {
            "name": "wallets",
            "type": {
              "array": [
                "pubkey",
                4
              ]
            }
          },
          {
            "name": "sessionSigners",
            "type": {
              "array": [
                "pubkey",
                4
              ]
            }
          },
          {
            "name": "refunded",
            "type": {
              "array": [
                "bool",
                4
              ]
            }
          },
          {
            "name": "economics",
            "type": {
              "option": {
                "defined": {
                  "name": "economicState"
                }
              }
            }
          }
        ]
      }
    },
    {
      "name": "roomPhase",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "funding"
          },
          {
            "name": "cancelled"
          },
          {
            "name": "started"
          }
        ]
      }
    },
    {
      "name": "sessionTokenV2",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "targetProgram",
            "type": "pubkey"
          },
          {
            "name": "sessionSigner",
            "type": "pubkey"
          },
          {
            "name": "feePayer",
            "type": "pubkey"
          },
          {
            "name": "validUntil",
            "type": "i64"
          }
        ]
      }
    }
  ]
};
