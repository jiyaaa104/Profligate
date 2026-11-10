import { Notification } from "../models/notification.model.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const getMyNotifications = asyncHandler(async (req, res) => {
  const notifications = await Notification.find({
    userId: req.user._id,
  })
    .select("title message type isRead createdAt")
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();

  return res
    .status(200)
    .json(
      new ApiResponse(200, notifications, "Notifications fetched successfully"),
    );
});

const markAsRead = asyncHandler(async (req, res) => {
  const result = await Notification.updateMany(
    {
      userId: req.user._id,
      isRead: false,
    },
    {
      $set: { isRead: true },
    },
  );

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        modifiedCount: result.modifiedCount,
      },
      "Notifications marked as read successfully",
    ),
  );
});

export { getMyNotifications, markAsRead };
