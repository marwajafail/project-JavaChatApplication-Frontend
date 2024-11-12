import React, { useEffect, useState } from 'react';
import { over } from 'stompjs'; // STOMP is a simple text-oriented messaging protocol
import SockJS from 'sockjs-client'; // SockJS is a JavaScript library for providing WebSocket-like objects
// Global variable to store the STOMP client
var stompClient = null;

const ChatRoom = () => {
 // State to manage private chats, public chats, current tab, and user data
    const [privateChats, setPrivateChats] = useState(new Map());
    const [publicChats, setPublicChats] = useState([]);
    const [tab, setTab] = useState("CHATROOM");
    const [userData, setUserData] = useState({
        username: '', // Store the username of the user
        receivername: '',  // Store the name of the user you are sending a private message to
        connected: false,  // Track if the user is connected to the chat
        message: '',   // Store the message the user wants to send
        editing: null, // For editing a message
        editMessageContent: '' // For storing the content of the message being edited
    });

    useEffect(() => {
        console.log('User data:', userData);
    }, [userData]);

    const connect = () => {
        let Sock = new SockJS('http://localhost:9092/ws'); // Create a new SockJS connection
        stompClient = over(Sock);
        stompClient.connect({}, onConnected, onError);
    }
// Function to connect to the chat server
    const onConnected = () => {
        setUserData({ ...userData, "connected": true });
        stompClient.subscribe('/chatroom/public', onMessageReceived);
        stompClient.subscribe('/user/' + userData.username + '/private', onPrivateMessage);
        userJoin();
    }
 // Function to notify the server that the user has joined
    const userJoin = () => {
        var chatMessage = {
            senderName: userData.username,
            status: "JOIN"
        };
        stompClient.send("/app/message", {}, JSON.stringify(chatMessage));
    }

   // Function to handle received public messages
       const onMessageReceived = (payload) => {
           var payloadData = JSON.parse(payload.body); // Parse the received message
           console.log('Received message:', payloadData);
           switch (payloadData.status) {
               case "JOIN":
                   if (!privateChats.get(payloadData.senderName)) {
                       privateChats.set(payloadData.senderName, []);// Add the new user to private chats
                       setPrivateChats(new Map(privateChats));
                   }
                   break;
               case "MESSAGE":
                   setPublicChats(prevChats => [...prevChats, payloadData]);// Add the new message to the public chat
                   break;
               case "EDITED":
                   const updatedPublicChats = publicChats.map(chat =>
                   // Update the edited message in public chat
                       chat.id === payloadData.id ? payloadData : chat
                   );
                   setPublicChats(updatedPublicChats);

                // Also update private chats if needed
                if (privateChats.has(payloadData.senderName)) {
                    const updatedPrivateChats = privateChats.get(payloadData.senderName).map(chat =>
                        chat.id === payloadData.id ? payloadData : chat
                    );
                    privateChats.set(payloadData.senderName, updatedPrivateChats);
                    setPrivateChats(new Map(privateChats));
                }
                break;
            default:
                break;
        }
    }
// Function to handle received private messages
    const onPrivateMessage = (payload) => {
        var payloadData = JSON.parse(payload.body); // Parse the received message
        console.log('Received private message:', payloadData);
        if (privateChats.get(payloadData.senderName)) {
            privateChats.get(payloadData.senderName).push(payloadData);
            setPrivateChats(new Map(privateChats));
        } else {
            let list = [];
            list.push(payloadData);
            privateChats.set(payloadData.senderName, list); // Create a new private chat if it doesn't exist
            setPrivateChats(new Map(privateChats));
        }
    }
// Function to handle errors during connection
    const onError = (err) => {
        console.log('WebSocket error:', err);
    }

    const handleMessage = (event) => {
        const { value } = event.target;
        setUserData({ ...userData, "message": value });
    }

    const handleEditMessage = (event) => {
        const { value } = event.target;
        setUserData({ ...userData, "editMessageContent": value });
    }

    const sendValue = () => {
        if (stompClient) {
            var chatMessage = {
                senderName: userData.username,
                message: userData.message,
                status: "MESSAGE"
            };
            stompClient.send("/app/message", {}, JSON.stringify(chatMessage));
            setUserData({ ...userData, "message": "" });
        }
    }

    const sendPrivateValue = () => {
        if (stompClient) {
            var chatMessage = {
                senderName: userData.username,
                receiverName: tab,
                message: userData.message,
                status: "MESSAGE"
            };
            if (userData.username !== tab) {
                privateChats.get(tab).push(chatMessage);
                setPrivateChats(new Map(privateChats));
            }
            stompClient.send("/app/private-message", {}, JSON.stringify(chatMessage));
            setUserData({ ...userData, "message": "" });
        }
    }

    const handleUsername = (event) => {
        const { value } = event.target;
        setUserData({ ...userData, "username": value });
    }
 // Function to start the connection when the user clicks "Connect"
    const registerUser = () => {
        connect();
    }
 // Function to start editing a message
    const startEditing = (messageId, messageContent) => {
        setUserData({ ...userData, editing: messageId, editMessageContent: messageContent });
    }
// Function to save the edited message
    const saveEditedMessage = () => {
        if (stompClient && userData.editing) {
            var updatedMessage = {
                id: userData.editing,
                senderName: userData.username,
                message: userData.editMessageContent,
                status: "EDITED"
            };
            console.log('Sending edited message:', updatedMessage);
            stompClient.send("/app/edit-message", {}, JSON.stringify(updatedMessage));

            // Update local state
            const updatedPublicChats = publicChats.map(chat =>
                chat.id === userData.editing ? { ...chat, message: userData.editMessageContent, lastModified: new Date() } : chat
            );
            setPublicChats(updatedPublicChats);

            // Also update private chats if needed
            if (privateChats.has(tab)) {
                const updatedPrivateChats = privateChats.get(tab).map(chat =>
                    chat.id === userData.editing ? { ...chat, message: userData.editMessageContent, lastModified: new Date() } : chat
                );
                privateChats.set(tab, updatedPrivateChats);
                setPrivateChats(new Map(privateChats));
            }

            setUserData({ ...userData, editing: null, editMessageContent: '' });
        }
    }

    return (
        <div className="container">
            {userData.connected ?
                <div className="chat-box">
                    <div className="member-list">
                        <ul>
                            <li onClick={() => { setTab("CHATROOM") }} className={`member ${tab === "CHATROOM" && "active"}`}>Chatroom</li>
                            {[...privateChats.keys()].map((name, index) => (
                                <li onClick={() => { setTab(name) }} className={`member ${tab === name && "active"}`} key={index}>{name}</li>
                            ))}
                        </ul>
                    </div>
                    {tab === "CHATROOM" && <div className="chat-content">
                        <ul className="chat-messages">
                            {publicChats.map((chat, index) => (
                                <li className={`message ${chat.senderName === userData.username && "self"}`} key={index}>
                                    {chat.senderName !== userData.username && <div className="avatar">{chat.senderName}</div>}
                                    <div className="message-data">
                                        {userData.editing === chat.id ? (
                                            <div>
                                                <input type="text" value={userData.editMessageContent} onChange={handleEditMessage} />
                                                <button onClick={saveEditedMessage}>Save</button>
                                            </div>
                                        ) : (
                                            chat.message
                                        )}
                                    </div>
                                    {chat.senderName === userData.username && <div className="avatar self">{chat.senderName}</div>}
                                    {chat.senderName === userData.username && !userData.editing && (
                                        <button onClick={() => startEditing(chat.id, chat.message)}>Edit</button>
                                    )}
                                </li>
                            ))}
                        </ul>

                        <div className="send-message">
                            <input type="text" className="input-message" placeholder="Enter your message" value={userData.message} onChange={handleMessage} />
                            <button type="button" className="send-button" onClick={sendValue}>Send</button>
                        </div>
                    </div>}
                    {tab !== "CHATROOM" && <div className="chat-content">
                        <ul className="chat-messages">
                            {[...privateChats.get(tab)].map((chat, index) => (
                                <li className={`message ${chat.senderName === userData.username && "self"}`} key={index}>
                                    {chat.senderName !== userData.username && <div className="avatar">{chat.senderName}</div>}
                                    <div className="message-data">
                                        {userData.editing === chat.id ? (
                                            <div>
                                                <input type="text" value={userData.editMessageContent} onChange={handleEditMessage} />
                                                <button onClick={saveEditedMessage}>Save</button>
                                            </div>
                                        ) : (
                                            chat.message
                                        )}
                                    </div>
                                    {chat.senderName === userData.username && <div className="avatar self">{chat.senderName}</div>}
                                    {chat.senderName === userData.username && !userData.editing && (
                                        <button onClick={() => startEditing(chat.id, chat.message)}>Edit</button>
                                    )}
                                </li>
                            ))}
                        </ul>

                        <div className="send-message">
                            <input type="text" className="input-message" placeholder="Enter your message" value={userData.message} onChange={handleMessage} />
                            <button type="button" className="send-button" onClick={sendPrivateValue}>Send</button>
                        </div>
                    </div>}
                </div>
                :
                <div>
                    <input type="text" placeholder="Enter your name" onChange={handleUsername} />
                    <button onClick={registerUser}>Connect</button>
                </div>
            }
        </div>
    );
}

export default ChatRoom;
